import os
import io
import mimetypes
import time
import logging
import openai
import sys
import re
import base64
import html
from io import BytesIO
from flask import Flask, request, jsonify, send_file, abort
from azure.identity import DefaultAzureCredential
from azure.search.documents import SearchClient
from approaches.retrievethenread import RetrieveThenReadApproach
from approaches.readretrieveread import ReadRetrieveReadApproach
from approaches.readdecomposeask import ReadDecomposeAsk
from approaches.chatreadretrieveread import ChatReadRetrieveReadApproach
from azure.storage.blob import BlobServiceClient
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from azure.search.documents.indexes.models import (
    HnswParameters,
    PrioritizedFields,
    SearchableField,
    SearchField,
    SearchFieldDataType,
    SearchIndex,
    SemanticConfiguration,
    SemanticField,
    SemanticSettings,
    SimpleField,
    VectorSearch,
    VectorSearchAlgorithmConfiguration,
)

from pypdf import PdfReader, PdfWriter
from tenacity import retry, stop_after_attempt, wait_random_exponential

# Replace these with your own values, either in environment variables or directly here
AZURE_STORAGE_ACCOUNT = os.environ.get("AZURE_STORAGE_ACCOUNT") or "mystorageaccount"
AZURE_STORAGE_CONTAINER = os.environ.get("AZURE_STORAGE_CONTAINER") or "content"
AZURE_STAGING_CONTAINER = os.environ.get("AZURE_STAGING_CONTAINER") or "staging"
AZURE_SEARCH_SERVICE = os.environ.get("AZURE_SEARCH_SERVICE") or "gptkb"
AZURE_SEARCH_INDEX = os.environ.get("AZURE_SEARCH_INDEX") or "gptkbindex"
AZURE_OPENAI_SERVICE = os.environ.get("AZURE_OPENAI_SERVICE") or "myopenai"
AZURE_OPENAI_GPT_DEPLOYMENT = os.environ.get("AZURE_OPENAI_GPT_DEPLOYMENT") or "davinci"
AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.environ.get("AZURE_OPENAI_CHATGPT_DEPLOYMENT") or "chat"
AZURE_OPENAI_CHATGPT_MODEL = os.environ.get("AZURE_OPENAI_CHATGPT_MODEL") or "gpt-35-turbo"
AZURE_OPENAI_EMB_DEPLOYMENT = os.environ.get("AZURE_OPENAI_EMB_DEPLOYMENT") or "embedding"
AZURE_FORMRECOGNIZER_SERVICE = os.environ.get("AZURE_FORMRECOGNIZER_SERVICE") or "someFormRecognizerService"
AZURE_OPENAI_EMB_DEPLOYMENT = os.environ.get("AZURE_OPENAI_EMB_DEPLOYMENT") or "embedding"
AZURE_FORMRECOGNIZER_KEY = os.environ.get("AZURE_FORMRECOGNIZER_KEY") or "someFormRecognizerKey"


KB_FIELDS_CONTENT = os.environ.get("KB_FIELDS_CONTENT") or "content"
KB_FIELDS_CATEGORY = os.environ.get("KB_FIELDS_CATEGORY") or "category"
KB_FIELDS_SOURCEPAGE = os.environ.get("KB_FIELDS_SOURCEPAGE") or "sourcepage"


open_ai_token_cache = {}
CACHE_KEY_TOKEN_CRED = 'openai_token_cred'
CACHE_KEY_CREATED_TIME = 'created_time'
CACHE_KEY_TOKEN_TYPE = 'token_type'

# Use the current user identity to authenticate with Azure OpenAI, Cognitive Search and Blob Storage (no secrets needed, 
# just use 'az login' locally, and managed identity when deployed on Azure). If you need to use keys, use separate AzureKeyCredential instances with the 
# keys for each service
# If you encounter a blocking error during a DefaultAzureCredntial resolution, you can exclude the problematic credential by using a parameter (ex. exclude_shared_token_cache_credential=True)
azure_credential = DefaultAzureCredential(exclude_shared_token_cache_credential = True)

# Used by the OpenAI SDK
openai.api_type = "azure"
openai.api_base = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com"
openai.api_version = "2023-05-15"

##Added APIM Endpoint if set 
AZURE_APIM_OPENAI_URL = os.environ.get("AZURE_APIM_OPENAI_URL", "")
if AZURE_APIM_OPENAI_URL != "":
    openai.api_base = AZURE_APIM_OPENAI_URL

# Comment these two lines out if using keys, set your API key in the OPENAI_API_KEY environment variable instead
openai.api_type = "azure_ad"
openai_token = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
openai.api_key = openai_token.token

# Set up clients for Cognitive Search and Storage
search_client = SearchClient(
    endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net",
    index_name=AZURE_SEARCH_INDEX,
    credential=azure_credential)
blob_client = BlobServiceClient(
    account_url=f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net", 
    credential=azure_credential)
blob_container = blob_client.get_container_client(AZURE_STORAGE_CONTAINER)

# Various approaches to integrate GPT and external knowledge, most applications will use a single one of these patterns
# or some derivative, here we include several for exploration purposes
ask_approaches = {
    "rtr": RetrieveThenReadApproach(search_client, AZURE_OPENAI_CHATGPT_DEPLOYMENT, AZURE_OPENAI_CHATGPT_MODEL, AZURE_OPENAI_EMB_DEPLOYMENT, KB_FIELDS_SOURCEPAGE, KB_FIELDS_CONTENT),
    "rrr": ReadRetrieveReadApproach(search_client, AZURE_OPENAI_GPT_DEPLOYMENT, AZURE_OPENAI_EMB_DEPLOYMENT, KB_FIELDS_SOURCEPAGE, KB_FIELDS_CONTENT),
    "rda": ReadDecomposeAsk(search_client, AZURE_OPENAI_GPT_DEPLOYMENT, AZURE_OPENAI_EMB_DEPLOYMENT, KB_FIELDS_SOURCEPAGE, KB_FIELDS_CONTENT)
}

chat_approaches = {
    "rrr": ChatReadRetrieveReadApproach(search_client, 
                                        AZURE_OPENAI_CHATGPT_DEPLOYMENT,
                                        AZURE_OPENAI_CHATGPT_MODEL, 
                                        AZURE_OPENAI_EMB_DEPLOYMENT,
                                        KB_FIELDS_SOURCEPAGE, 
                                        KB_FIELDS_CONTENT)
}

app = Flask(__name__)

@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_file(path):
    return app.send_static_file(path)

# Serve content files from blob storage from within the app to keep the example self-contained. 
# *** NOTE *** this assumes that the content files are public, or at least that all users of the app
# can access all the files. This is also slow and memory hungry.
@app.route("/content/<path>")
def content_file(path):
    blob = blob_container.get_blob_client(path).download_blob()
    if not blob.properties or not blob.properties.has_key("content_settings"):
        abort(404)
    mime_type = blob.properties["content_settings"]["content_type"]
    if mime_type == "application/octet-stream":
        mime_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    blob_file = io.BytesIO()
    blob.readinto(blob_file)
    blob_file.seek(0)
    return send_file(blob_file, mimetype=mime_type, as_attachment=False, download_name=path)
    
@app.route("/ask", methods=["POST"])
def ask():
    ensure_openai_token()
    if not request.json:
        return jsonify({"error": "request must be json"}), 400
    approach = request.json["approach"]
    try:
        impl = ask_approaches.get(approach)
        if not impl:
            return jsonify({"error": "unknown approach"}), 400
        r = impl.run(request.json["question"], request.json.get("overrides") or {})
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /ask")
        return jsonify({"error": str(e)}), 500
    
@app.route("/chat", methods=["POST"])
def chat():
    ensure_openai_token()
    if not request.json:
        return jsonify({"error": "request must be json"}), 400
    approach = request.json["approach"]
    try:
        impl = chat_approaches.get(approach)
        if not impl:
            return jsonify({"error": "unknown approach"}), 400
        r = impl.run(request.json["history"], request.json.get("overrides") or {})
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /chat")
        return jsonify({"error": str(e)}), 500

@app.route("/readyFiles", methods=["GET"])
def indexes():
    ensure_openai_token()
    try: 
        blob_service_client = BlobServiceClient(account_url=f"https://" + AZURE_STORAGE_ACCOUNT + ".blob.core.windows.net", credential=azure_credential)
        container_client = blob_service_client.get_container_client(AZURE_STAGING_CONTAINER) 
        blobs = container_client.list_blobs()
        files = [] 
        for blob in blobs:
            files.append({
                "size": blob.size, 
                "name": blob.name
                })
        return jsonify(files)
    except Exception as e:
        logging.exception("Exception in /readyFiles")
        return jsonify({"error": str(e)}), 500


@app.route("/removeStagedFile", methods=["POST"])
def removeStaged():
    
    ensure_openai_token()
    try:
        file = request.json["fileName"]
        blob_service_client = BlobServiceClient(account_url=f"https://" + AZURE_STORAGE_ACCOUNT + ".blob.core.windows.net", credential=azure_credential)
        container_client = blob_service_client.get_container_client(AZURE_STAGING_CONTAINER) 
        container_client.delete_blob(file)
        return jsonify({"result":"File removed from Azure Storage!"})
    except Exception as e:
        logging.exception("Exception in /removeStagedFile")
        return jsonify({"error": str(e)}), 500

@app.route("/upload", methods=["POST"])
def upload():
    ensure_openai_token()
    try:

        sys.stdout.write("Upload Started")
        sys.stdout.write("starting file \n")
        sys.stdout.flush()
        file = request.files['file']
        sys.stdout.write("file \n" + str(file.name))
        sys.stdout.flush()
        # Connect to Azure Storage
        blob_service_client = BlobServiceClient(account_url=f"https://" + AZURE_STORAGE_ACCOUNT + ".blob.core.windows.net", credential=azure_credential)
        container_client = blob_service_client.get_container_client(AZURE_STAGING_CONTAINER)

        # Upload the file to Azure Storage
        blob_client = container_client.get_blob_client(file.filename)
        blob_client.upload_blob(file, overwrite=True)
        #with file as data:
        #    container_client.upload_blob(file.name, data, overwrite=True)

        sys.stdout.write("End \n")
        sys.stdout.flush()
        return jsonify({"result":"File uploaded to Azure Storage!"})
    except Exception as e:
        logging.exception("Exception in /upload")
        return jsonify({"error": str(e)}), 500

@app.route("/indexUploadedFiles", methods=["GET"])
def indexUploadedFiles():
    ensure_openai_token()
    try:
        # Connect to Azure Storage
        blob_service_client = BlobServiceClient(account_url=f"https://" + AZURE_STORAGE_ACCOUNT + ".blob.core.windows.net", credential=azure_credential)
        container_client = blob_service_client.get_container_client(AZURE_STAGING_CONTAINER)
        upload_client = blob_service_client.get_container_client(AZURE_STORAGE_CONTAINER)

        #get Azure AD Token
        openai.api_key = azure_credential.get_token("https://cognitiveservices.azure.com/.default").token
        openai.api_type = "azure_ad"
        open_ai_token_cache[CACHE_KEY_CREATED_TIME] = time.time()
        open_ai_token_cache[CACHE_KEY_TOKEN_CRED] = azure_credential
        open_ai_token_cache[CACHE_KEY_TOKEN_TYPE] = "azure_ad"
        # Get a list of all blobs in a container
        blobs = container_client.list_blobs()
        files = []
        for blob in blobs:
            # get the blob to bytes
            blob_client = container_client.get_blob_client(blob.name)
            downloaded_blob = blob_client.download_blob()
            pdf_bytes = downloaded_blob.content_as_bytes()
            if blob.name.lower().endswith('.pdf'):
                # convert to pdf and split pages for pdf files
                pdf = PdfReader(BytesIO(pdf_bytes))
                pages = pdf.pages
                for i in range(len(pages)):
                    blob_name = blob.name[:-len(".pdf")] + "-" + str(i) + ".pdf"
                    f = io.BytesIO()
                    writer = PdfWriter()
                    writer.add_page(pages[i])
                    writer.write(f)
                    f.seek(0)
                    upload_client.upload_blob(blob_name, f, overwrite=True)
                    files.append(blob_name)
            else:
                upload_client.upload_blob(blob.name, b, overwrite=True)
                files.append(blob.name)
        
        blobs = container_client.list_blobs()
        # Index the files     
        for file in blobs:
            sys.stdout.write("Processing file \n" + str(file.name))
            sys.stdout.flush()   
            page_map = get_document_text(file.name, blob_service_client, container_client)
            use_vectors = True
            sections = create_sections(file.name, page_map, use_vectors)
            index_sections(file.name, sections)
            #Remove File after indexing
            container_client.delete_blob(file.name)

        

        return "Files indexed!"
    except Exception as e:
        logging.exception("Exception in /indexUploadedFiles")
        return jsonify({"error": str(e)}), 500


def ensure_openai_token():
    global openai_token
    if openai_token.expires_on < int(time.time()) - 60:
        openai_token = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
        openai.api_key = openai_token.token

def blob_name_from_file_page(filename, page = 0):
    if os.path.splitext(filename)[1].lower() == ".pdf":
        return os.path.splitext(os.path.basename(filename))[0] + f"-{page}" + ".pdf"
    else:
        return os.path.basename(filename)


def index_sections(filename, sections):
    print(f"Indexing sections from '{filename}' into search index '{AZURE_SEARCH_INDEX}'")
    search_client = SearchClient(endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net/",
                                    index_name=AZURE_SEARCH_INDEX,
                                    credential=azure_credential)
    i = 0
    batch = []
    for s in sections:
        batch.append(s)
        i += 1
        if i % 1000 == 0:
            results = search_client.upload_documents(documents=batch)
            succeeded = sum([1 for r in results if r.succeeded])
            print(f"\tIndexed {len(results)} sections, {succeeded} succeeded")
            batch = []

    if len(batch) > 0:
        results = search_client.upload_documents(documents=batch)
        succeeded = sum([1 for r in results if r.succeeded])
        print(f"\tIndexed {len(results)} sections, {succeeded} succeeded")


def split_text(page_map, filename):
    MAX_SECTION_LENGTH = 1000
    SENTENCE_SEARCH_LIMIT = 100
    SECTION_OVERLAP = 100
    SENTENCE_ENDINGS = [".", "!", "?"]
    WORDS_BREAKS = [",", ";", ":", " ", "(", ")", "[", "]", "{", "}", "\t", "\n"]
    print(f"Splitting '{filename}' into sections")

    def find_page(offset):
        num_pages = len(page_map)
        for i in range(num_pages - 1):
            if offset >= page_map[i][1] and offset < page_map[i + 1][1]:
                return i
        return num_pages - 1

    all_text = "".join(p[2] for p in page_map)
    length = len(all_text)
    start = 0
    end = length
    while start + SECTION_OVERLAP < length:
        last_word = -1
        end = start + MAX_SECTION_LENGTH

        if end > length:
            end = length
        else:
            # Try to find the end of the sentence
            while end < length and (end - start - MAX_SECTION_LENGTH) < SENTENCE_SEARCH_LIMIT and all_text[end] not in SENTENCE_ENDINGS:
                if all_text[end] in WORDS_BREAKS:
                    last_word = end
                end += 1
            if end < length and all_text[end] not in SENTENCE_ENDINGS and last_word > 0:
                end = last_word # Fall back to at least keeping a whole word
        if end < length:
            end += 1

        # Try to find the start of the sentence or at least a whole word boundary
        last_word = -1
        while start > 0 and start > end - MAX_SECTION_LENGTH - 2 * SENTENCE_SEARCH_LIMIT and all_text[start] not in SENTENCE_ENDINGS:
            if all_text[start] in WORDS_BREAKS:
                last_word = start
            start -= 1
        if all_text[start] not in SENTENCE_ENDINGS and last_word > 0:
            start = last_word
        if start > 0:
            start += 1

        section_text = all_text[start:end]
        yield (section_text, find_page(start))

        last_table_start = section_text.rfind("<table")
        if (last_table_start > 2 * SENTENCE_SEARCH_LIMIT and last_table_start > section_text.rfind("</table")):
            # If the section ends with an unclosed table, we need to start the next section with the table.
            # If table starts inside SENTENCE_SEARCH_LIMIT, we ignore it, as that will cause an infinite loop for tables longer than MAX_SECTION_LENGTH
            # If last table starts inside SECTION_OVERLAP, keep overlapping
            print(f"Section ends with unclosed table, starting next section with the table at page {find_page(start)} offset {start} table start {last_table_start}")
            start = min(end - SECTION_OVERLAP, start + last_table_start)
        else:
            start = end - SECTION_OVERLAP

    if start + SECTION_OVERLAP < end:
        yield (all_text[start:end], find_page(start))


def filename_to_id(filename):
    filename_ascii = re.sub("[^0-9a-zA-Z_-]", "_", filename)
    filename_hash = base64.b16encode(filename.encode('utf-8')).decode('ascii')
    return f"file-{filename_ascii}-{filename_hash}"

def refresh_openai_token():
    if open_ai_token_cache[CACHE_KEY_TOKEN_TYPE] == 'azure_ad' and open_ai_token_cache[CACHE_KEY_CREATED_TIME] + 300 < time.time():
        token_cred = open_ai_token_cache[CACHE_KEY_TOKEN_CRED]
        openai.api_key = token_cred.get_token("https://cognitiveservices.azure.com/.default").token
        open_ai_token_cache[CACHE_KEY_CREATED_TIME] = time.time()


def before_retry_sleep(retry_state):
    print("Rate limited on the OpenAI embeddings API, sleeping before retrying...")


@retry(wait=wait_random_exponential(min=10, max=60), stop=stop_after_attempt(15), before_sleep=before_retry_sleep)
def compute_embedding(text):
    refresh_openai_token()
    return openai.Embedding.create(engine=AZURE_OPENAI_EMB_DEPLOYMENT, input=text)["data"][0]["embedding"]

def create_sections(filename, page_map, use_vectors):
    file_id = filename_to_id(filename)
    for i, (content, pagenum) in enumerate(split_text(page_map, filename)):
        section = {
            "id": f"{file_id}-page-{i}",
            "content": content,
            "category": KB_FIELDS_CATEGORY,
            "sourcepage": blob_name_from_file_page(filename, pagenum),
            "sourcefile": filename
        }
        if use_vectors:
            section["embedding"] = compute_embedding(content)
        yield section

def table_to_html(table):
    table_html = "<table>"
    rows = [sorted([cell for cell in table.cells if cell.row_index == i], key=lambda cell: cell.column_index) for i in range(table.row_count)]
    for row_cells in rows:
        table_html += "<tr>"
        for cell in row_cells:
            tag = "th" if (cell.kind == "columnHeader" or cell.kind == "rowHeader") else "td"
            cell_spans = ""
            if cell.column_span > 1: cell_spans += f" colSpan={cell.column_span}"
            if cell.row_span > 1: cell_spans += f" rowSpan={cell.row_span}"
            table_html += f"<{tag}{cell_spans}>{html.escape(cell.content)}</{tag}>"
        table_html +="</tr>"
    table_html += "</table>"
    return table_html

def get_document_text(filename, blob_service_client, container_client):
    offset = 0
    page_map = []

    
    #form_recognizer_client = DocumentAnalysisClient(endpoint=f"https://{AZURE_FORMRECOGNIZER_SERVICE}.cognitiveservices.azure.com/", credential=azure_credential, headers={"x-ms-useragent": "azure-search-chat-demo/1.0.0"})
    #form_recognizer_client = DocumentAnalysisClient(endpoint=f"https://{AZURE_FORMRECOGNIZER_SERVICE}.cognitiveservices.azure.com/", credential=azure_credential)
    form_recognizer_client = DocumentAnalysisClient(endpoint=f"https://{AZURE_FORMRECOGNIZER_SERVICE}.cognitiveservices.azure.com/", credential=AzureKeyCredential(AZURE_FORMRECOGNIZER_KEY))
    b = container_client.download_blob(filename).readall()
    poller = form_recognizer_client.begin_analyze_document('prebuilt-document', document = b)
    form_recognizer_results = poller.result()

    for page_num, page in enumerate(form_recognizer_results.pages):
        tables_on_page = [table for table in form_recognizer_results.tables if table.bounding_regions[0].page_number == page_num + 1]

        # mark all positions of the table spans in the page
        page_offset = page.spans[0].offset
        page_length = page.spans[0].length
        table_chars = [-1]*page_length
        for table_id, table in enumerate(tables_on_page):
            for span in table.spans:
                # replace all table spans with "table_id" in table_chars array
                for i in range(span.length):
                    idx = span.offset - page_offset + i
                    if idx >=0 and idx < page_length:
                        table_chars[idx] = table_id

        # build page text by replacing characters in table spans with table html
        page_text = ""
        added_tables = set()
        for idx, table_id in enumerate(table_chars):
            if table_id == -1:
                page_text += form_recognizer_results.content[page_offset + idx]
            elif table_id not in added_tables:
                page_text += table_to_html(tables_on_page[table_id])
                added_tables.add(table_id)

        page_text += " "
        page_map.append((page_num, offset, page_text))
        offset += len(page_text)

    return page_map

if __name__ == "__main__":
    app.run()

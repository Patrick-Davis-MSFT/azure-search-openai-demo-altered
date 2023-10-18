import azure.functions as func

import os
import json
import io
import mimetypes
import time
import logging
import openai
import threading
import queue
import sys
import re
import base64
import html
from io import BytesIO
#from flask import Flask, request, jsonify, send_file, abort, Response
from azure.identity import DefaultAzureCredential
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from approaches.indexFiles import indexFiles
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
OPENAI_EMB_MODEL = os.getenv("AZURE_OPENAI_EMB_MODEL_NAME", "text-embedding-ada-002")
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
#logging.basicConfig(level=logging.DEBUG)
#azure_credential = DefaultAzureCredential(exclude_shared_token_cache_credential = True, logging_enable=True)
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

indexFiles_approaches = {
    "irf": indexFiles(AZURE_STORAGE_ACCOUNT,
                            AZURE_STAGING_CONTAINER, 
                            AZURE_STORAGE_CONTAINER,
                            AZURE_FORMRECOGNIZER_SERVICE, 
                            AZURE_FORMRECOGNIZER_KEY, 
                            AZURE_SEARCH_SERVICE, 
                            AZURE_OPENAI_EMB_DEPLOYMENT, 
                            AZURE_OPENAI_SERVICE)
}



app = func.FunctionApp()

@app.function_name(name="env-check")
@app.route(route="env-check")
def main(req: func.HttpRequest) -> str:
    logging.info("Called env-check")
    return f"AZURE_STORAGE_ACCOUNT: {AZURE_STORAGE_ACCOUNT}, AZURE_STORAGE_CONTAINER: {AZURE_STORAGE_CONTAINER}, AZURE_SEARCH_SERVICE: {AZURE_SEARCH_SERVICE}, AZURE_SEARCH_INDEX: {AZURE_SEARCH_INDEX}, AZURE_OPENAI_SERVICE: {AZURE_OPENAI_SERVICE}, AZURE_OPENAI_GPT_DEPLOYMENT: {AZURE_OPENAI_GPT_DEPLOYMENT}, AZURE_OPENAI_CHATGPT_DEPLOYMENT: {AZURE_OPENAI_CHATGPT_DEPLOYMENT}, AZURE_OPENAI_CHATGPT_MODEL: {AZURE_OPENAI_CHATGPT_MODEL}, OPENAI_EMB_MODEL: {OPENAI_EMB_MODEL}, AZURE_OPENAI_EMB_DEPLOYMENT: {AZURE_OPENAI_EMB_DEPLOYMENT}, AZURE_FORMRECOGNIZER_SERVICE: {AZURE_FORMRECOGNIZER_SERVICE}, KB_FIELDS_CONTENT: {KB_FIELDS_CONTENT}, KB_FIELDS_CATEGORY: {KB_FIELDS_CATEGORY}, KB_FIELDS_SOURCEPAGE: {KB_FIELDS_SOURCEPAGE}"


@app.function_name(name="health")
@app.route(route="health")
def health(req: func.HttpRequest) -> str:
    return f"Up and Running!"


def ensure_openai_token():
    global openai_token
    if openai_token.expires_on < int(time.time()) - 60:
        openai_token = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
        openai.api_key = openai_token.token

@app.function_name(name="indexfun")
@app.route("indexfun", methods=["OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def indexfun(req: func.HttpRequest):
    logging.debug("Called Indexing Function OPTIONS")
    return "something"

@app.function_name(name="indexfunBLOB")
@app.blob_trigger(arg_name="myblob", 
                  path=AZURE_STAGING_CONTAINER,
                  connection="conn" )
def indexfunBLOB(myblob: func.InputStream):
    logging.info("BLOB Indexing Function")
    ensure_openai_token()
    
    blobName = str(myblob.name)
    logging.info(str(myblob.name))
    if (not blobName.endswith("!!!indexThis.json")):
        return None
    
    # read indexing file to get index name
    blob_service_client = BlobServiceClient(account_url=f"https://" + AZURE_STORAGE_ACCOUNT + ".blob.core.windows.net", credential=azure_credential)
    container_client = blob_service_client.get_container_client(AZURE_STAGING_CONTAINER)

    blob_client = container_client.get_blob_client(myblob.name.split("/")[-1])
    downloaded_blob = blob_client.download_blob()
    raw = downloaded_blob.readall()
    jsonObj = json.loads(raw)
    
    logging.info(str(jsonObj))
    index = str(jsonObj['index'])
    if index.lower() == "default":
        index = AZURE_SEARCH_INDEX
   
    logging.info("loading to index: " + index)
    for files in jsonObj['files']:
        logging.info(str(files))
    
    approach = "irf"
    #logging.info("here 1")
    impl = indexFiles_approaches.get(approach)
    #logging.info("here 2")
    impl.run(index, openai_token, azure_credential, jsonObj['files']) 
    
    container_client.delete_blob(myblob.name.split("/")[-1])
    return None

@app.function_name(name="indexfunPOST")
@app.route("indexfun", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def indexfun(req: func.HttpRequest):
    logging.info("Called Indexing Function")
    ensure_openai_token()
    reqJson = req.get_json()
    if not reqJson:
        return jsonify({"error": "request must be json"}), 400
    
    #out = queue.Queue()

    index = str(reqJson["index"])
    if index.lower() == "default":
        index = AZURE_SEARCH_INDEX
    def indexProcess(n,index, out:queue.Queue):
        approach = "irf"
        logging.info("here 2")
        impl = indexFiles_approaches.get(approach)
        #TODO: Fix this to actually work
        impl.run(index, openai_token, azure_credential) 

    #thread = threading.Thread(target=indexProcess, args=(1,index, out))
    #thread.start()
    
    #def generate():
    #    while(thread.is_alive()):
    #        apiResult:str = None
    #        if not out.empty():
    #            apiResult = out.get()
    #        if apiResult is not None:
    #            yield apiResult + "\n"
    
    approach = "irf"
    #logging.info("here 1")
    impl = indexFiles_approaches.get(approach)
    #logging.info("here 2")
    impl.run(index, openai_token, azure_credential) 
    #response = StreamingHttpResponse(generate(), content_type='text/plain')
    #logging.info("here 3")  
    return func.HttpResponse("Indexed Files", mimetype='text/plain')
    #return  func.HttpResponse(b''.join(generate()), content_type='text/plain')
    #return func.HttpResponse("Done Indexing", mimetype='text/plain')

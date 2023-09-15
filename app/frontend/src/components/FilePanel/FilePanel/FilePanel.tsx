import { CommandButton, DefaultButton, Dropdown, FocusZone, FocusZoneDirection, IDropdownOption, List, Panel, Text, TextField } from "@fluentui/react";
//using https://github.com/Jaaneek/useFilePicker
import { useFilePicker, FileContent, FileError } from 'use-file-picker';


import styles from "./FilePanel.module.css";
import { MouseEventHandler, useEffect, useRef, useState } from "react";
import { OptResponse, OptResponses, ReadyFile, RetrievalMode, getIndexesAPI, getReadyFiles, indexReadyFiles, postFile, postFile2, removeStagedFile, streamToBlob, uploadBlob, } from "../../../api";
import { Document24Regular, Delete24Regular } from "@fluentui/react-icons";

interface Props {
    className?: string;
    show: boolean;
    close: (cls: boolean) => void;
    setIndex: (idx: ReadyFile) => void;
}



export const FilePanel = ({ className, show, close, setIndex }: Props) => {

    const [uploadedFileList, setUploadedFileList] = useState<ReadyFile[]>([]);
    const [uploadList, setUploadList] = useState<FileContent[]>([]); //list of files to upload
    const [uploadIndexDisabled, setUploadIndexDisabled] = useState<boolean>(false); //disable index button
    const [error, setError] = useState<string | null>(null);
    const [searchIndex, setSearchIndex] = useState<OptResponse>({ "value": "default", "label": "Default" } as OptResponse);
    const [searchIndexOptions, setSearchIndexOptions] = useState<OptResponses>([] as OptResponses);
    const [addIndex, setAddIndex] = useState<string>("" as string);
    const [disableAddIndex, setDisableAddIndex] = useState<boolean>(false);


    useEffect(() => {
        const getIndexes = async () => {
            if (searchIndexOptions.length > 0) return;
            const response = await getIndexesAPI();
            const data = await response;
            setSearchIndexOptions([]);
            setSearchIndexOptions((searchIndexOptions) => [...searchIndexOptions, { "value": "default", "label": "Default" }]);
            data.forEach((item: OptResponse) => {
                setSearchIndexOptions((searchIndexOptions) => [...searchIndexOptions, item]);
            });
        };
        setSearchIndexOptions([]);
        getIndexes();
    }, []);

    const setReadyFileList = async () => {
        const fileIdx = await getReadyFiles();
        setUploadedFileList(fileIdx);
        return true;
    };

    const callIndexFiles = async () => {
        try {
            setError("Indexing... (This can take some time)")
            const retValue = await indexReadyFiles(searchIndex.value);
            console.log(retValue);
            await setReadyFileList();
        }
        catch (error: any) {
            console.log(error);
            alert(`An error occurred: ${error.message}`);
            setError(error.message);
        }
        setError(null);
        setUploadIndexDisabled(false);
    };
    const indexFilesPress = () => {
        setUploadIndexDisabled(true);
        return callIndexFiles();
    };

    useEffect(() => {
        const run = async () => {
            await setReadyFileList();
        }
        run();
    }, []);

    const UploadFile = () => {
        const run = async (f: FileContent) => {
            const sentFile = await postFile(f);
            await setReadyFileList();
            return true;
        };
        try {
            uploadList.forEach((f) => {
                const sentFile = run(f);
                console.log("Finished" + sentFile);
            });
        }
        catch (error: any) {
            console.log(error);
            alert(`An error occurred: ${error.message}`);
            setError(error.message);
        }
        setUploadList([]);
    };

    const addUploadList = (file: FileContent) => {
        var newUploadList = [...uploadList];
        newUploadList.push(file);
        setUploadList(newUploadList);
    };
    const [openFileSelector, { filesContent, loading }] = useFilePicker({
        accept: ['.csv', '.json', '.txt', '.tsv', '.xlsx', '.xls', '.xml', '.docx', '.doc', '.pdf'],
        limitFilesConfig: { min: 1, max: 3 },
        maxFileSize: 500, // in megabytes
        onFilesSelected: ({ plainFiles, filesContent, errors }) => {
            // this callback is always called, even if there are errors
            console.log('onFilesSelected', plainFiles, filesContent);
            if (filesContent) {
                filesContent.forEach((f: FileContent) => addUploadList(f));
                //postFile2(plainFiles[0].name, filesContent[0])
            }
            if (errors) {
                errors.forEach((e: FileError) => alert("ERROR: " + e.name));
            }
        },
    });

    /*const onRenderCell = (item?: FileContent, index?: number | undefined): JSX.Element | null => {
        if (!item) return null;
        return (<>
            <div className={styles.fileOptContainer}>
                <span className={styles.fileOption}><Document24Regular /> {item.name}</span>
            </div>
        </>);
    };*/

    const removeItem = (name: string) => {
        setUploadIndexDisabled(true);
        const removeStagedItem = async (name: string) => {
            const result = await removeStagedFile(name);
            console.log(result);
            await setReadyFileList();
            setUploadIndexDisabled(false);
        }
        removeStagedItem(name);
    }
    const onRenderCellFiles = (item?: ReadyFile, index?: number | undefined): JSX.Element | null => {
        if (!item) return null;
        console.log(item);
        return (<>
            <div className={styles.fileOptContainer}>
                <span className={styles.fileOption}><Document24Regular />
                    <Text variant="large">{item.name}</Text>
                    <CommandButton onClick={() => removeItem(item.name)}><Delete24Regular />
                    </CommandButton>
                </span>
            </div>
        </>);
    };

    const [file, setFile] = useState<File | null>(null);
    const [fileUploading, setFileUploading] = useState<boolean>(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!file) return;
        try {
            setFileUploading(true);
            console.log("loading: " + file.name);
            const blob = await streamToBlob(file.stream());
            await uploadBlob(blob, file.name);
            console.log("done: " + file.name);
            await setReadyFileList();
            setFile(null);
        }
        catch (error: any) {
            console.log(error);
            alert(`An error occurred: ${error.message}`);
            setError(error.message);
        }
        setFileUploading(false);
    }

    const indexDropdownOptions = (): any[] => {
        let opt: Array<any> = []

        if (searchIndexOptions.length == 0) return opt;
        if (Array.isArray(searchIndexOptions)) {
            opt = searchIndexOptions.map((item) => {
                return { key: item.value, text: item.label, selected: searchIndex.value == item.value, data: item.value };
            });
        }
        return opt;
    }

    const onIndexChange = (_ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption<RetrievalMode> | undefined, index?: number | undefined) => {
        if (option?.data) {
            setSearchIndex({ value: option?.data, label: option?.text });
        }
    };

    const onAddIndexChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        if (!newValue) { return; }
        if (newValue.length <= 25) {
            setAddIndex(newValue);
        }
    };

    const addIndexBtn = () => {
        const newIndex: OptResponse = { "value": addIndex, "label": addIndex };
        setSearchIndexOptions((searchIndexOptions) => [...searchIndexOptions, newIndex]);
        setSearchIndex(newIndex);
        setDisableAddIndex(true);
    }

    return (
        <Panel
            headerText="File Indexing"
            isOpen={show}
            isBlocking={false}
            onDismiss={() => close(false)}
            closeButtonAriaLabel="Close File Indexing"
            onRenderFooterContent={() => <DefaultButton onClick={() => close(false)}>Close</DefaultButton>}
            isFooterAtBottom={true}
        >
            <Dropdown
                className={styles.chatSettingsSeparator}
                label="Search Index"
                options={indexDropdownOptions()}
                required
                onChange={onIndexChange}
            />
            {disableAddIndex ? null : <>
                <TextField label="Add Index" value={addIndex} onChange={onAddIndexChange} />
                <DefaultButton className={styles.buttonSpace} onClick={() => addIndexBtn()} disabled={uploadIndexDisabled}>Add</DefaultButton> </>}
            <hr />
            {fileUploading ? <h3>File Uploading... Please Wait</h3> : <>
                <h3>File Upload</h3>
                <form onSubmit={handleSubmit}>
                    <input
                        type="file"
                        accept=".pdf"
                        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                    <button type="submit" disabled={!file}>
                        Upload
                    </button>
                </form></>}

            <hr />
            <h3>Ready for Indexing</h3>
            <div>

                <DefaultButton className={styles.buttonSpace} onClick={() => indexFilesPress()} disabled={uploadIndexDisabled}>Upload Index</DefaultButton>
                <List items={uploadedFileList} onRenderCell={onRenderCellFiles} />
                {error ? <Text variant="large" style={{ color: "red" }}>{error}</Text> : null}
            </div>

        </Panel>
    );
};

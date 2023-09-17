import { CommandButton, ContextualMenu, DefaultButton, Dropdown, FocusZone, FocusZoneDirection, IDragOptions, IDropdownOption, List, Modal, Panel, Stack, Text, TextField, mergeStyles } from "@fluentui/react";
//using https://github.com/Jaaneek/useFilePicker
import { useId, useBoolean } from '@fluentui/react-hooks';


import styles from "./FilePanel.module.css";
import { MouseEventHandler, useEffect, useRef, useState } from "react";
import { OptResponse, OptResponses, ReadyFile, RetrievalMode, getIndexesAPI, getReadyFiles, indexReadyFiles, indexReadyFilesStream, postFile, postFile2, removeStagedFile, streamToBlob, uploadBlob, } from "../../../api";
import { Document24Regular, Delete24Regular } from "@fluentui/react-icons";
import React from "react";

interface Props {
    className?: string;
    show: boolean;
    close: (cls: boolean) => void;
    setIndex: (idx: ReadyFile) => void;
}



export const FilePanel = ({ className, show, close, setIndex }: Props) => {

    const [uploadedFileList, setUploadedFileList] = useState<ReadyFile[]>([]);
    const [uploadIndexDisabled, setUploadIndexDisabled] = useState<boolean>(false); //disable index button
    const [error, setError] = useState<string | null>(null);
    const [searchIndex, setSearchIndex] = useState<OptResponse>({ "value": "default", "label": "Default" } as OptResponse);
    const [searchIndexOptions, setSearchIndexOptions] = useState<OptResponses>([] as OptResponses);
    const [addIndex, setAddIndex] = useState<string>("" as string);
    const [disableAddIndex, setDisableAddIndex] = useState<boolean>(false);
    const [streamOutput, setStreamOutput] = useState<string>("");


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

    const getStreamOutput = (data: string) => {
        setStreamOutput(data);
    }

    function delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const callIndexFiles = async () => {
        try {
            showModal();
            //const retValue = await indexReadyFiles(searchIndex.value);
            const retValue = await indexReadyFilesStream(searchIndex.value, getStreamOutput);
            console.log(retValue);
            await setReadyFileList();
            await delay(2500);
            hideModal();
        }
        catch (error: any) {
            console.log(error);
            alert(`An error occurred: ${error.message}`);
            setError(error.message);
            hideModal();
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
        if (!newValue) { setAddIndex(""); return; }
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


    const [isModalOpen, { setTrue: showModal, setFalse: hideModal }] = useBoolean(false);
    const [isDraggable, { toggle: toggleIsDraggable }] = useBoolean(false);
    const [keepInBounds, { toggle: toggleKeepInBounds }] = useBoolean(false);
    const dragOptions = React.useMemo(
        (): IDragOptions => ({
            moveMenuItemText: 'Move',
            closeMenuItemText: 'Close',
            menu: ContextualMenu,
            keepInBounds,
            dragHandleSelector: '.ms-Modal-scrollableContent > div:first-child',
        }),
        [keepInBounds],
    );
    const modalTitleId = useId('modalId');


    return (
        <>
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
                        <button type="submit" disabled={!file || uploadedFileList.length > 4}>
                            {uploadedFileList.length > 4 ? "Indexing Limit Reached" : "Upload"}
                        </button>
                    </form>
                    <small>Only PDF and up to 5</small>
                </>}

                <hr />
                <h3>Ready for Indexing</h3>
                <div>

                    <DefaultButton className={styles.buttonSpace} onClick={() => indexFilesPress()} disabled={uploadIndexDisabled}>Upload Index</DefaultButton>
                    <List items={uploadedFileList} onRenderCell={onRenderCellFiles} />
                    {error ? <Text variant="large" style={{ color: "red" }}>{error}</Text> : null}
                </div>

            </Panel>
            <Modal
                titleAriaId={modalTitleId}
                isOpen={isModalOpen}
                onDismiss={hideModal}
                isBlocking={true}
                containerClassName={mergeStyles(styles.modalContainer)}
                dragOptions={isDraggable ? dragOptions : undefined}>

                <Stack enableScopedSelectors>
                    <Stack.Item className={styles.overlayContent}>
                        <div className={mergeStyles(styles.modalHeader)}>
                            <h2>Indexing Files...</h2>
                        </div>
                    </Stack.Item>
                    <Stack.Item align="center" className={styles.overlayContent}>
                        <pre className={mergeStyles(styles.indexOut)}>{streamOutput}</pre>
                    </Stack.Item>
                </Stack>
            </Modal>
        </>
    );
};

import { DefaultButton, Dropdown, FocusZone, FocusZoneDirection, List, Panel, Text, TextField } from "@fluentui/react";
//using https://github.com/Jaaneek/useFilePicker
import { useFilePicker, FileContent, FileError } from 'use-file-picker';


import styles from "./FilePanel.module.css";
import { useEffect, useState } from "react";
import { ReadyFile, getReadyFiles, postFile } from "../../../api";
import { Document24Regular } from "@fluentui/react-icons";

interface Props {
    className?: string;
    show: boolean;
    close: (cls: boolean) => void;
    setIndex: (idx: ReadyFile) => void;
}



export const FilePanel = ({ className, show, close, setIndex }: Props) => {

    const [uploadedFileList, setUploadedFileList] = useState<ReadyFile[]>([]);
    const [uploadList, setUploadList] = useState<FileContent[]>([]); //list of files to upload
    const setReadyFileList = async () => {
        const fileIdx = await getReadyFiles();
        setUploadedFileList(fileIdx);
        return true;
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
        uploadList.forEach((f) => {
            const sentFile = run(f);
            console.log("Finished" + sentFile);
        });
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
            }
            if (errors) {
                errors.forEach((e: FileError) => alert("ERROR: " + e.name));
            }
        },
    });

    const onRenderCell = (item?: FileContent, index?: number | undefined): JSX.Element | null => {
        if (!item) return null;
        return (<>
            <div className={styles.fileOptContainer}>
                <span className={styles.fileOption}><Document24Regular /> {item.name}</span>
            </div>
        </>);
    };

    const onRenderCellFiles = (item?: ReadyFile, index?: number | undefined): JSX.Element | null => {
        if (!item) return null;
        console.log(item);
        return (<>
            <div className={styles.fileOptContainer}>
                <span className={styles.fileOption}><Document24Regular /> {item.name}</span>
            </div>
        </>);
    };

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
            <hr />
            <h3>Files to Upload</h3>
            <DefaultButton onClick={() => openFileSelector()}>Select Files</DefaultButton>
            {uploadList.length > 0 ? (<><h4>Selected Files</h4>
                <List items={uploadList} onRenderCell={onRenderCell} />
                <DefaultButton className={styles.buttonSpace} onClick={() => UploadFile()}>Upload</DefaultButton>
            </>) : null}
            <hr />
            <h3>Ready for Indexing</h3>
            <div>
                <List items={uploadedFileList} onRenderCell={onRenderCellFiles} /></div>

        </Panel>
    );
};

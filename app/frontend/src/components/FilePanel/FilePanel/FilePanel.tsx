import { DefaultButton, Dropdown, List, Panel, Text, TextField } from "@fluentui/react";
//using https://github.com/Jaaneek/useFilePicker
import { useFilePicker, FileContent, FileError } from 'use-file-picker';


import styles from "./FilePanel.module.css";
import { useEffect, useState } from "react";
import { Index, Indexes, getIndexes, postFile } from "../../../api";
import { Document24Regular } from "@fluentui/react-icons";

interface Props {
    className?: string;
    show: boolean;
    close: (cls: boolean) => void;
    setIndex: (idx: Index) => void;
}



export const FilePanel = ({ className, show, close, setIndex }: Props) => {

    const [fileIndexList, setFileIndexList] = useState<Index[]>([]);
    const [uploadList, setUploadList] = useState<FileContent[]>([]); //list of files to upload
    useEffect(() => {
        const run = async () => {
            const fileIdx = await getIndexes();
            setFileIndexList(fileIdx);
            return true;
        }
        run();
    }, []);

    const UploadFile = () => {
        const run = async (f: FileContent) => {
            const sentFile = await postFile(f);
            return true;
        };
        uploadList.forEach((f) => {
            const sentFile = run(f);
            console.log("Finished" + sentFile);
        });
    };

    const onIndexChange = (key?: string | number, text?: string) => {
        setIndex({ id: key as string, name: text || "" });
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
            <span><Document24Regular /> {item.name}</span>
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
            <h3>Files Index configuration</h3>
            <div>
                <Dropdown
                    label="File Index List"
                    options={fileIndexList.map((i) => ({ key: i.id, text: i.name }))}
                    onChange={(ev, item) => onIndexChange(item?.key, item?.text)}
                /></div>
        </Panel>
    );
};

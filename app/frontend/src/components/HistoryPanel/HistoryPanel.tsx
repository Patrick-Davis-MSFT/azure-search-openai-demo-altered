import { DefaultButton, Dropdown, List, Panel, Text, TextField } from "@fluentui/react";


import styles from "./HistoryPanel.module.css";
import { useEffect, useState } from "react";
import { Document24Regular } from "@fluentui/react-icons";

interface Props {
    className?: string;
    show: boolean;
    close: (cls: boolean) => void;
}



export const HistoryPanel = ({ className, show, close }: Props) => {


    const [historyList, setHistoryList] = useState<string[]>([]);


    const onRenderCell = (item?: string, index?: number | undefined): JSX.Element | null => {
        if (!item) return null;
        return (<>
            <span><Document24Regular /> {item}</span>
        </>);
    };

    return (
        <Panel
            headerText="Chat History"
            isOpen={show}
            isBlocking={false}
            onDismiss={() => close(false)}
            closeButtonAriaLabel="Close Chat History"
            onRenderFooterContent={() => <DefaultButton onClick={() => close(false)}>Close</DefaultButton>}
            isFooterAtBottom={true}
        >
            <div><h3>history here</h3></div>
            <List items={historyList} onRenderCell={onRenderCell} />
        </Panel>
    );
};

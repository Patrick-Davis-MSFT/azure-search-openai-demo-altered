import { Text } from "@fluentui/react";
import { DocumentTableSearch24Regular } from "@fluentui/react-icons";

import styles from "./FileButton.module.css";

interface Props {
    className?: string;
    onClick: () => void;
}

export const FileButton = ({ className, onClick }: Props) => {
    return (
        <div className={`${styles.container} ${className ?? ""}`} onClick={onClick}>
            < DocumentTableSearch24Regular />
            <Text className={styles.settingsText}>{"File Indexes"}</Text>
        </div>
    );
};

import { Text } from "@fluentui/react";
import { History24Regular } from "@fluentui/react-icons";

import styles from "./HistoryButton.module.css";

interface Props {
    className?: string;
    onClick: () => void;
}

export const HistoryButton = ({ className, onClick }: Props) => {
    return (
        <div className={`${styles.container} ${className ?? ""}`} onClick={onClick}>
            <History24Regular />
            <Text className={styles.settingsText}>{"Chat History"}</Text>
        </div>
    );
};

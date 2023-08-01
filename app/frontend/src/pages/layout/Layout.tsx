import { Outlet, NavLink, Link } from "react-router-dom";

import github from "../../assets/github.svg";

import styles from "./Layout.module.css";
import { HistoryButton } from "../../components/HistoryButton";
import { FileButton } from "../../components/FilePanel/FileButton";
import { useState } from "react";
import { Index } from "../../api";
import { HistoryPanel } from "../../components/HistoryPanel";
import { FilePanel } from "../../components/FilePanel/FilePanel";
import { mergeStyleSets, mergeStyles } from "@fluentui/react";

const Layout = () => {

    const [isHistPanelOpen, setIsHistPanelOpen] = useState(false);
    const [isFilePanelOpen, setIsFilePanelOpen] = useState(false);
    const [fileIndexList, setFileIndexList] = useState<Index[]>([]);

    const addFileIndexList = (file: Index) => {
        var newFileIndexList = [...fileIndexList];
        newFileIndexList.push(file);
        setFileIndexList(newFileIndexList);
    };

    return (
        <div className={styles.layout}>
            <header className={styles.header} role={"banner"}>
                <div className={styles.headerContainer}>
                    <Link to="/" className={styles.headerTitleContainer}>
                        <h3 className={styles.headerTitle}>GPT + Enterprise data | Sample</h3>
                    </Link>
                    <nav>
                        <ul className={styles.headerNavList}>
                            <li>
                                <NavLink to="/" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Chat
                                </NavLink>
                            </li>
                            <li className={styles.headerNavLeftMargin}>
                                <NavLink to="/qa" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Ask a question
                                </NavLink>
                            </li>
                            <li className={styles.headerNavLeftMargin}>
                                <a href="https://aka.ms/entgptsearch" target={"_blank"} title="Github repository link">
                                    <img
                                        src={github}
                                        alt="Github logo"
                                        aria-label="Link to github repository"
                                        width="20px"
                                        height="20px"
                                        className={styles.githubLogo}
                                    />
                                </a>
                            </li>
                        </ul>
                    </nav>
                    <span>
                        <h4 className={styles.headerRightText}>Azure OpenAI + Cognitive Search</h4>
                        <div className={styles.headerRightText2}>
                            {false ? <></> : <HistoryButton className={styles.settingsButton} onClick={() => setIsHistPanelOpen(!isHistPanelOpen)} />}
                            {false ? <></> : <FileButton className={styles.settingsButton} onClick={() => setIsFilePanelOpen(!isFilePanelOpen)} />}
                            <FilePanel
                                show={isFilePanelOpen}
                                close={(cls: boolean) => setIsFilePanelOpen(false)}
                                setIndex={(idx: Index) => addFileIndexList(idx)}
                            />
                            <HistoryPanel
                                show={isHistPanelOpen}
                                close={(cls: boolean) => setIsHistPanelOpen(false)}
                            />
                        </div>
                    </span>
                </div>

            </header>

            <Outlet />
        </div>
    );
};

export default Layout;

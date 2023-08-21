import { Example } from "./Example";
import { WhiteBoxModel } from "../WhiteBox/WhiteBox";

import styles from "./Example.module.css";

export type ExampleModel = {
    text: string;
    value: string;
};

const EXAMPLES: ExampleModel[] = [
    {
        text: "What is included in my Northwind Health Plus plan that is not in standard?",
        value: "What is included in my Northwind Health Plus plan that is not in standard?"
    },
    { text: "What happens in a performance review?", value: "What happens in a performance review?" },
    { text: "What does a Product Manager do?", value: "What does a Product Manager do?" }
];

interface Props {
    onExampleClicked: (value: string) => void;
}

export const ExampleList = ({ onExampleClicked }: Props) => {
    var examplePrompts: ExampleModel[] = EXAMPLES;
    if (WhiteBoxModel.useWhiteBox) {
        examplePrompts = WhiteBoxModel.example;
    }
    return (
        <ul className={styles.examplesNavList}>
            {examplePrompts.map((x, i) => (
                <li key={i}>
                    <Example text={x.text} value={x.value} onClick={onExampleClicked} />
                </li>
            ))}
        </ul>
    );
};

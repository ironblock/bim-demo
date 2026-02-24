import { type PickedElementInfo } from "../../hooks/useIfcPicking";
import { type IfcModelState } from "../../hooks/useIfcModel";
import styles from "./Viewer.module.css";

type Props = {
  pickedElement: PickedElementInfo;
  modelState: IfcModelState | null;
};

export default function InfoOverlay({ pickedElement, modelState }: Props) {
  let text: string | null = null;

  if (pickedElement) {
    text = `${pickedElement.typeName} | ${pickedElement.elementName} | ID: ${pickedElement.expressID}`;
  } else if (modelState?.projectInfo) {
    const { projectName, author, application } = modelState.projectInfo;
    const parts: Array<string | null> = [
      projectName ?? `Project: ${projectName}`,
      author ?? `Author: ${author}`,
      application ?? `App: ${application}`,
    ].filter(String);
    text = parts.join(" | ");
  }

  return text ?? <div className={styles.overlay}>{text}</div>;
}

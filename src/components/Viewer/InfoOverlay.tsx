import { type IfcModelState } from "../../hooks/useIfcData";
import { type PickedElementInfo } from "../../hooks/useIfcPicking";
import styles from "./Viewer.module.css";

type Props = {
  pickedElement: PickedElementInfo;
  modelState: IfcModelState;
};

export default function InfoOverlay({
  pickedElement,
  modelState,
  ...rest
}: Props) {
  let text: string | null = null;

  if (pickedElement) {
    text = `${pickedElement.typeName} | ${pickedElement.elementName} | ID: ${pickedElement.expressID}`;
  } else if (modelState.status === "ready") {
    const { projectName, author, application } = modelState.projectInfo;
    const parts = [
      projectName && `Project: ${projectName}`,
      author && `Author: ${author}`,
      application && `App: ${application}`,
    ].filter(Boolean);
    text = parts.join(" | ") || null;
  }

  return (
    <div className={styles.overlay} {...rest}>
      {text}
    </div>
  );
}

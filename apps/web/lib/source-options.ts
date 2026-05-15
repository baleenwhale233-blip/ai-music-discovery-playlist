export type VisibleSourceId = "bilibili" | "youtube";
export type VisibleSourceStatus = "available" | "experimental";

export interface VisibleSourceOption {
  id: VisibleSourceId;
  label: string;
  helper: string;
  status: VisibleSourceStatus;
}

export const visibleSourceOptions: VisibleSourceOption[] = [
  {
    id: "bilibili",
    label: "B站",
    helper: "当前可解析",
    status: "available"
  },
  {
    id: "youtube",
    label: "YouTube",
    helper: "实验预留",
    status: "experimental"
  }
];

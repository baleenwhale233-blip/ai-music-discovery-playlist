export type VisibleSourceId = "bilibili";
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
  }
];

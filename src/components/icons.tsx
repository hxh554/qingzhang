const S = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const IconHome = () => <svg {...S}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>;
export const IconList = () => <svg {...S}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="0.8" fill="currentColor" /><circle cx="3.5" cy="12" r="0.8" fill="currentColor" /><circle cx="3.5" cy="18" r="0.8" fill="currentColor" /></svg>;
export const IconChart = () => <svg {...S}><path d="M4 20V10M10 20V4M16 20v-8M21 20H3" /></svg>;
export const IconTag = () => <svg {...S}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
export const IconSettings = () => <svg {...S}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
export const IconEye = ({ off }: { off?: boolean }) => (
  <svg {...S}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
    {off && <line x1="4" y1="4" x2="20" y2="20" />}
  </svg>
);
export const IconChevron = ({ up }: { up?: boolean }) => (
  <svg {...S} style={{ transform: up ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6" /></svg>
);
export const IconBack = () => <svg {...S}><path d="m15 18-6-6 6-6" /></svg>;
export const IconPlus = () => <svg {...S}><path d="M12 5v14M5 12h14" /></svg>;
export const IconSearch = () => <svg {...S}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const IconLeft = () => <svg {...S}><path d="m15 18-6-6 6-6" /></svg>;
export const IconRight = () => <svg {...S}><path d="m9 18 6-6-6-6" /></svg>;
export const IconTrash = () => <svg {...S}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>;
export const IconEdit = () => <svg {...S}><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>;
export const IconCopy = () => <svg {...S}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
export const IconDownload = () => <svg {...S}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>;
export const IconUpload = () => <svg {...S}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>;

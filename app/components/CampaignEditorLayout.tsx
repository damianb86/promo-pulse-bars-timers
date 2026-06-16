import type { ReactNode } from "react";

type CampaignEditorLayoutProps = {
  details: ReactNode;
  settings?: ReactNode;
  translations: ReactNode;
  design: ReactNode;
};

export function CampaignEditorLayout({
  details,
  settings,
  translations,
  design,
}: CampaignEditorLayoutProps) {
  return (
    <div className="counterpulse-editor-layout">
      <div>{details}</div>
      {settings && <div>{settings}</div>}
      <div>{translations}</div>
      <div>{design}</div>
    </div>
  );
}

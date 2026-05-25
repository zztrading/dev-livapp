import { ReportButton } from "@/components/lessons/shared/ReportButton";

interface V8ReportButtonProps {
  lessonId: string;
  pageContext?: Record<string, unknown>;
}

/**
 * V8ReportButton — thin wrapper preserved for backward compatibility.
 * The unified component lives at `src/components/lessons/shared/ReportButton.tsx`.
 */
export const V8ReportButton = ({ lessonId, pageContext }: V8ReportButtonProps) => {
  return <ReportButton lessonId={lessonId} pageContext={pageContext} variant="light" />;
};

export default V8ReportButton;

import { useContext } from 'react';
import { ReportDraftContext } from './reportDraftContextObject';

export function useReportDraft() {
  const context = useContext(ReportDraftContext);
  if (!context) {
    throw new Error('useReportDraft must be used within a ReportDraftProvider');
  }
  return context;
}

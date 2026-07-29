"use client";

import type { DashboardReport, TikTokLibraryReport } from "@/lib/types";
import { CrossChannelIntelligence } from "@/components/dashboard/cross-channel-intelligence";
import { CreativeLab } from "@/components/dashboard/creative-lab";
import { ExperimentWorkspace } from "@/components/dashboard/experiment-workspace";
import { BudgetOperations } from "@/components/dashboard/budget-operations";
import { ConnectorWorkspace } from "@/components/dashboard/connector-workspace";
import { AiPromptWorkspace } from "@/components/dashboard/ai-prompt-workspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function IntelligenceWorkspace({ report, tiktokReport, language }: { report: DashboardReport | null; tiktokReport: TikTokLibraryReport | null; language: "en" | "vi" }) {
  return <Tabs defaultValue="summary" className="gap-4">
    <div className="overflow-x-auto"><TabsList className="min-w-max"><TabsTrigger value="summary">Summary</TabsTrigger><TabsTrigger value="creative">Creative lab</TabsTrigger><TabsTrigger value="experiments">Experiments</TabsTrigger><TabsTrigger value="budget">Budget</TabsTrigger><TabsTrigger value="connections">Connections</TabsTrigger><TabsTrigger value="ai">AI system</TabsTrigger></TabsList></div>
    <TabsContent value="summary"><CrossChannelIntelligence report={report} tiktokReport={tiktokReport} language={language} /></TabsContent>
    <TabsContent value="creative"><CreativeLab language={language} /></TabsContent>
    <TabsContent value="experiments"><ExperimentWorkspace language={language} /></TabsContent>
    <TabsContent value="budget"><BudgetOperations language={language} /></TabsContent>
    <TabsContent value="connections"><ConnectorWorkspace language={language} /></TabsContent>
    <TabsContent value="ai"><AiPromptWorkspace language={language} /></TabsContent>
  </Tabs>;
}

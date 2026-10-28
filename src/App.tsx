import React, { useState, useRef } from 'react';
import { useDjiStore, ActiveTab } from './hooks/useDjiStore';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { DashboardTab } from './components/DashboardTab';
import { SalesBreakdownTab } from './components/SalesBreakdownTab';
import { DailyReportTab } from './components/DailyReportTab';
import { SalesRhythmTab } from './components/SalesRhythmTab';
import { StaffTab } from './components/StaffTab';
import { ProductsTab } from './components/ProductsTab';
import { LeadsTab } from './components/LeadsTab';
import { StockTab } from './components/StockTab';
import { ImportInventoryTab } from './components/ImportInventoryTab';
import { CoachTab } from './components/CoachTab';
import { TasksTab } from './components/TasksTab';
import { QuickLogCard } from './components/QuickLogCard';
import { BackupModal } from './components/BackupModal';
import { ClearSystemDataModal } from './components/ClearSystemDataModal';

export default function App() {
  const store = useDjiStore();
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  const quickLogRef = useRef<HTMLDivElement>(null);

  const scrollToQuickLog = () => {
    if (store.activeTab !== 't') {
      store.setActiveTab('t');
      setTimeout(() => {
        quickLogRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      quickLogRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Determine review offset for Daily Report tab
  const dailyReportOffset = store.reviewDayOffset ?? Math.max(0, store.endOffset - 1);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* App Header */}
      <Header
        todayOffset={store.todayDayOffset}
        cloudSyncStatus={store.cloudSyncStatus}
        onSyncNow={store.syncNow}
        syncFeedback={store.syncFeedback}
        pulseMetrics={store.pulseMetrics}
        onUpdateDailyGoal={store.updateDailyGoal}
        onExport={store.exportDataJSON}
        onImportClick={() => setIsBackupModalOpen(true)}
        onReset={() => setIsClearDataModalOpen(true)}
        onJumpToQuickLog={scrollToQuickLog}
      />

      {/* Tabs & Period Navigation */}
      <Navigation
        activeTab={store.activeTab}
        onSelectTab={store.setActiveTab}
        daysCount={store.daysCount}
        onSelectDaysCount={store.setDaysCount}
        selectedMonth={store.selectedMonth}
        onSelectMonth={store.setSelectedMonth}
        endOffset={store.endOffset}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Active Tab View */}
        {store.activeTab === 'd' && (
          <DashboardTab
            sales={store.allSales}
            periodRange={store.periodRange}
            stockMetrics={store.stockMetrics}
            endOffset={store.endOffset}
            localLeads={store.localLeads}
            staffList={store.staff}
            promoterMonthlyTargets={store.promoterMonthlyTargets}
            mainPushTargets={store.mainPushTargets}
            mainPushVariants={store.mainPushVariants}
            mainPushDividers={store.mainPushDividers}
            onUpdateMainPushTargets={store.updateAllMainPushTargets}
            onResetMainPushTargets={store.resetMainPushTargets}
            onDeleteMainPushTarget={store.deleteMainPushTarget}
            onAddSale={store.addSale}
          />
        )}

        {store.activeTab === 'b' && (
          <SalesBreakdownTab
            sales={store.allSales}
            staffList={store.staff}
          />
        )}

        {store.activeTab === 't' && (
          <div className="space-y-8">
            <DailyReportTab
              isTodayMode={true}
              selectedDayOffset={store.todayDayOffset}
              onSelectDayOffset={() => {}}
              sales={store.allSales}
              staffList={store.staff}
              finalizedDays={store.finalizedDays}
              dailyGoal={store.dailyGoal}
              promoterMonthlyTargets={store.promoterMonthlyTargets}
              localLeads={store.localLeads}
              onToggleFinalize={store.toggleFinalizeDay}
              onResetLeads={store.resetLeadsForDay}
            />

            {/* Quick Log POS & Activity Feed Card - ONLY IN TODAY TAB */}
            <div ref={quickLogRef} className="pt-2">
              <QuickLogCard
                todayOffset={store.todayDayOffset}
                staffList={store.staff}
                localSales={store.localSales}
                localLeads={store.localLeads}
                finalizedDays={store.finalizedDays}
                onAddSale={store.addSale}
                onAddSalesBulk={store.addSalesBulk}
                onOverrideSales={store.overrideSales}
                onAppendSales={store.appendSales}
                onDeleteSale={store.deleteSale}
                onAddLead={store.addLead}
                onRemoveLead={store.removeLead}
                onResetLeads={store.resetLeadsForDay}
                onToggleFinalize={store.toggleFinalizeDay}
                onClearAllSystemData={() => setIsClearDataModalOpen(true)}
                onSearchSN={store.searchSerialNumber}
              />
            </div>
          </div>
        )}

        {store.activeTab === 'y' && (
          <DailyReportTab
            isTodayMode={false}
            selectedDayOffset={dailyReportOffset}
            onSelectDayOffset={store.setReviewDayOffset}
            sales={store.allSales}
            staffList={store.staff}
            finalizedDays={store.finalizedDays}
            dailyGoal={store.dailyGoal}
            promoterMonthlyTargets={store.promoterMonthlyTargets}
            localLeads={store.localLeads}
            onToggleFinalize={store.toggleFinalizeDay}
            onResetLeads={store.resetLeadsForDay}
          />
        )}

        {store.activeTab === 'r' && (
          <SalesRhythmTab
            sales={store.allSales}
            endOffset={store.endOffset}
            periodRange={store.periodRange}
            staffNames={store.staff}
          />
        )}

        {store.activeTab === 's' && (
          <StaffTab
            sales={store.allSales}
            periodRange={store.periodRange}
            staffList={store.staff}
            promoterMonthlyTargets={store.promoterMonthlyTargets}
            onUpdatePromoterTarget={store.updatePromoterTarget}
            localLeads={store.localLeads}
            onUpdateStaff={store.updateStaff}
            onUpdatePromoterName={store.updatePromoterName}
            onAddPromoter={store.addPromoter}
            onRemovePromoter={store.removePromoter}
            onResetStaffToDefault={store.resetStaffToDefault}
          />
        )}

        {store.activeTab === 'p' && (
          <ProductsTab
            sales={store.allSales}
            periodRange={store.periodRange}
          />
        )}

        {store.activeTab === 'l' && (
          <LeadsTab
            sales={store.allSales}
            periodRange={store.periodRange}
            staffList={store.staff}
            localLeads={store.localLeads}
            onResetAllLeads={store.resetAllLeads}
          />
        )}

        {store.activeTab === 'i' && (
          <StockTab
            stockMetrics={store.stockMetrics}
            units={store.activeUnits}
            onWipeStock={store.deleteAllInventory}
            onDeleteUnits={store.deleteInventoryUnits}
          />
        )}

        {store.activeTab === 'inv' && (
          <ImportInventoryTab
            units={store.activeUnits}
            onImportAppend={store.importInventoryAppend}
            onImportOverride={store.importInventoryOverride}
            onAddUnit={store.addInventoryUnit}
            onDeleteUnit={store.deleteInventoryUnit}
            onResetToMaster={store.resetInventoryToMaster}
            onDeleteAllInventory={store.deleteAllInventory}
          />
        )}

        {store.activeTab === 'c' && (
          <CoachTab
            sales={store.allSales}
            periodRange={store.periodRange}
            staffList={store.staff}
            stockMetrics={store.stockMetrics}
          />
        )}

        {store.activeTab === 'k' && (
          <TasksTab
            localTasks={store.localTasks}
            onToggleTask={store.toggleTask}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">DJI Authorized Retail Store</span>
            <span aria-hidden="true">·</span>
            <span>SM City Dasmariñas</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-400">Operator Hub v2.0</span>
          </div>
          <div>
            Built on official inventory: sales from Aug 1, 2026 to Day #{store.endOffset} & live stock on hand.
          </div>
        </div>
      </footer>

      {/* Backup & Restore Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onExport={store.exportDataJSON}
        onImport={store.importDataJSON}
        onReset={store.resetToOriginalData}
      />

      {/* Clear All System Data Modal */}
      <ClearSystemDataModal
        isOpen={isClearDataModalOpen}
        onClose={() => setIsClearDataModalOpen(false)}
        onConfirmClear={store.clearAllSystemData}
        currentSalesCount={store.allSales.length}
      />
    </div>
  );
}

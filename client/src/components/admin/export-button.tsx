import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet, FileType } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportButtonProps {
  data: any[];
  filename: string;
  headers: string[];
  rowMapping: (item: any) => any[];
  columnWidths?: number[];
}

export function ExportButton({ data, filename, headers, rowMapping, columnWidths }: ExportButtonProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const exportToExcel = async () => {
    try {
      if (!data || data.length === 0) {
        toast({
          title: "No data to export",
          description: "There are no records available to export",
          variant: "destructive",
        });
        return;
      }

      setIsExporting(true);

      // Prepare data rows
      const rows = data.map(rowMapping);

      // Using xlsx library
      const xlsx = await import('xlsx');

      // Create worksheet
      const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);

      // Create workbook and add worksheet
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Data');

      // Set column widths if provided
      if (columnWidths) {
        const wscols = columnWidths.map(width => ({ wch: width }));
        worksheet['!cols'] = wscols;
      }

      // Generate Excel file
      const dateStr = new Date().toISOString().split('T')[0];
      xlsx.writeFile(workbook, `${filename}-${dateStr}.xlsx`);

      toast({
        title: "Export successful",
        description: "Data has been exported to Excel",
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Export failed",
        description: "Could not generate Excel file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = async () => {
    try {
      if (!data || data.length === 0) {
        toast({
          title: "No data to export",
          description: "There are no records available to export",
          variant: "destructive",
        });
        return;
      }

      setIsExporting(true);

      // Prepare data rows
      const rows = data.map(rowMapping);

      // Using jspdf and jspdf-autotable libraries
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      // Create PDF document
      const doc = new jsPDF();

      // Add title
      const dateStr = new Date().toISOString().split('T')[0];
      const title = `${filename} - ${dateStr}`;
      doc.setFontSize(18);
      doc.text(title, 14, 22);

      // Add table
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 30,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [240, 100, 69], textColor: [255, 255, 255] }, // Theme color #F06445
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 30 },
      });

      // Save PDF file
      doc.save(`${filename}-${dateStr}.pdf`);

      toast({
        title: "Export successful",
        description: "Data has been exported to PDF",
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast({
        title: "Export failed",
        description: "Could not generate PDF file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // CSV Export function
  const exportToCSV = () => {
    try {
      if (!data || data.length === 0) {
        toast({
          title: "No data to export",
          description: "There are no records available to export",
          variant: "destructive",
        });
        return;
      }

      setIsExporting(true);

      // Prepare data rows
      const rows = data.map(rowMapping);

      // Create CSV content
      let csvContent = headers.join(",") + "\n";

      // Add data rows to CSV content with proper escaping
      rows.forEach(row => {
        const escapedRow = row.map(cell => {
          // Convert to string and escape any quotes
          const cellStr = String(cell);
          if (cellStr.includes(",") || cellStr.includes("\"") || cellStr.includes("\n")) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        });
        csvContent += escapedRow.join(",") + "\n";
      });

      // Create a Blob with the CSV content
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

      // Create a download link
      const dateStr = new Date().toISOString().split('T')[0];
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}-${dateStr}.csv`);
      link.style.visibility = 'hidden';

      // Append the link to the body, click it, and remove it
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export successful",
        description: "Data has been exported to CSV",
      });
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      toast({
        title: "Export failed",
        description: "Could not generate CSV file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={isExporting || !data || data.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? "Exporting..." : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV}>
          <FileType className="h-4 w-4 mr-2" />
          <span>CSV (.csv)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          <span>Excel (.xlsx)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="h-4 w-4 mr-2" />
          <span>PDF (.pdf)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

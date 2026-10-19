import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter } from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";

interface Column<T> {
  header: string;
  accessorKey: keyof T | ((row: T) => string | JSX.Element);
  cell?: (row: T) => JSX.Element;
  className?: string;
  hidden?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  searchTerm?: string;
  onSearch?: (term: string) => void;
  onFilter?: () => void;
  pageSize?: number;
  customFilter?: JSX.Element;
}

export function DataTable<T>({
  data,
  columns,
  isLoading = false,
  onRowClick,
  searchPlaceholder = "Search...",
  searchTerm: externalSearchTerm = "",
  onSearch,
  onFilter,
  pageSize = 10,
  customFilter,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [internalSearchTerm, setInternalSearchTerm] = useState(externalSearchTerm);
  const isMobile = useMobile();

  // Sync internal state with external prop
  useEffect(() => {
    setInternalSearchTerm(externalSearchTerm);
  }, [externalSearchTerm]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = data.slice(startIndex, endIndex);
  const totalPages = Math.ceil(data.length / pageSize);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInternalSearchTerm(value);
    setPage(1);
    if (onSearch) {
      onSearch(value);
    }
  };

  const LoadingRow = () => (
    <TableRow>
      <TableCell colSpan={columns.filter(col => !col.hidden || !isMobile).length} className="h-24 text-center">
        <div className="flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
          <span className="ml-2">Loading...</span>
        </div>
      </TableCell>
    </TableRow>
  );

  const EmptyRow = () => (
    <TableRow>
      <TableCell colSpan={columns.filter(col => !col.hidden || !isMobile).length} className="h-24 text-center">
        No results found.
      </TableCell>
    </TableRow>
  );

  return (
    <div className="w-full">
      {onSearch && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={internalSearchTerm}
              onChange={handleSearch}
              className="pl-9 w-full sm:w-auto min-w-[200px]"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            {customFilter}
            {onFilter && (
              <Button onClick={onFilter} variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column, i) => (
                  (!column.hidden || !isMobile) && (
                    <TableHead key={i} className={column.className}>
                      {column.header}
                    </TableHead>
                  )
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <LoadingRow />
              ) : paginatedData.length === 0 ? (
                <EmptyRow />
              ) : (
                paginatedData.map((row, rowIndex) => (
                  <TableRow
                    key={rowIndex}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                  >
                    {columns.map((column, colIndex) => (
                      (!column.hidden || !isMobile) && (
                        <TableCell key={colIndex} className={column.className}>
                          {column.cell
                            ? column.cell(row)
                            : typeof column.accessorKey === 'function'
                              ? column.accessorKey(row)
                              : row[column.accessorKey] as any}
                        </TableCell>
                      )
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              <div className="mx-2 flex items-center">
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
              </div>
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { USE_FACTORY_ABI_DROPCODE } from "@/newHooks/useFACTORY_ABI_DROPCODE";

export default function TestFactoryPage() {
    const CONTRACT = "0x8D1306b3970278b3AB64D1CE75377BDdf00f61da";
    const [selectedFaucet, setSelectedFaucet] = useState("");
    
    // Separate pagination states
    const [faucetTxPage, setFaucetTxPage] = useState(1);
    const [allTxPage, setAllTxPage] = useState(1);
    
    const itemsPerPage = 10;
    const allTxPerPage = 100;

    const {
        // GETTER HOOKS (Read Functions)
        useGetAllFaucets,
        useGetAllTransactions,
        useGetFaucetDetails,
        useGetFaucetTransactions,
        useGetOwner,

        // SETTER HOOKS (Write Functions)
        useCreateBackendFaucet,
        useRecordTransaction,
        useRenounceOwnership,
        useTransferOwnership,

        // EVENT HOOKS (Watch Contract Events)
        useWatchFaucetCreated,
        useWatchOwnershipTransferred,
        useWatchTransactionRecorded,
    } = USE_FACTORY_ABI_DROPCODE();

    // ===== READ HOOKS =====
    const { data: faucets = [] } = useGetAllFaucets(CONTRACT) as { data: string[] };
    const { data: faucetDetails } = useGetFaucetDetails(CONTRACT, selectedFaucet as `0x${string}`);
    const { data: faucetTxs = [] } = useGetFaucetTransactions(CONTRACT, selectedFaucet as `0x${string}`) as { data: string[] };
    const { data: owner } = useGetOwner(CONTRACT);
    const { data: allTxs = [] } = useGetAllTransactions(CONTRACT) as { data: string[] };

    // Faucet transactions pagination
    const faucetTxPages = Math.ceil(faucetTxs.length / itemsPerPage);
    const currentFaucetTxs = faucetTxs.slice(
        (faucetTxPage - 1) * itemsPerPage,
        faucetTxPage * itemsPerPage
    );

    // All transactions pagination
    const allTxTotalPages = Math.ceil(allTxs.length / allTxPerPage);
    const currentAllTxs = allTxs.slice(
        (allTxPage - 1) * allTxPerPage,
        allTxPage * allTxPerPage
    );

    useEffect(() => {
        if (faucets.length > 0 && !selectedFaucet) {
            setSelectedFaucet(faucets[0]);
        }
    }, [faucets, selectedFaucet]);

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <h1 className="text-3xl font-bold mb-8">DROPCODE Factory Dashboard</h1>

            {/* Contract Info */}
            <div className="p-4 mb-6 bg-slate-900 rounded-lg">
                <h2 className="text-xl font-semibold mb-2">Contract Information</h2>
                <p><span className="font-medium">Contract Address:</span> {CONTRACT}</p>
                <p><span className="font-medium">Owner:</span> {`${owner || "Loading..."}`}</p>
            </div>

            {/* Faucet Selection */}
            <div className="mb-6">
                <label htmlFor="faucet-select" className="block text-sm font-medium text-gray-500 mb-2">
                    Select Faucet ({faucets.length})
                </label>
                <select
                    id="faucet-select"
                    className="w-full p-2 border border-slate-800 bg-slate-900 text-white rounded-md shadow-sm"
                    value={selectedFaucet}
                    onChange={(e) => setSelectedFaucet(e.target.value)}
                >
                    {faucets.length === 0 ? (
                        <option value="">No faucets available</option>
                    ) : (
                        faucets.map((faucet) => (
                            <option key={faucet} value={faucet}>
                                {faucet}
                            </option>
                        ))
                    )}
                </select>
            </div>

            {/* Faucet Details */}
            {selectedFaucet && (
                <div className="bg-slate-800 shadow overflow-hidden sm:rounded-lg mb-6">
                    <div className="px-4 py-5 sm:px-6 bg-slate-900">
                        <h3 className="text-lg leading-6 font-medium text-gray-200">Faucet Details</h3>
                        <p className="mt-1 max-w-2xl text-sm text-gray-300">Details for the selected faucet</p>
                    </div>
                    <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
                        <dl className="sm:divide-y sm:divide-gray-200">
                            {faucetDetails ? (
                                Object.entries(faucetDetails).map(([key, value]) => (
                                    <div key={key} className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-50">
                                            {key}
                                        </dt>
                                        <dd className="mt-1 text-sm text-gray-400 sm:mt-0 sm:col-span-2">
                                            {String(value)}
                                        </dd>
                                    </div>
                                ))
                            ) : (
                                <div className="py-4 text-center text-gray-500">
                                    Loading faucet details...
                                </div>
                            )}
                        </dl>
                    </div>
                </div>
            )}

            {/* Transactions */}
            <div className="bg-slate-900 shadow overflow-hidden sm:rounded-lg mb-6">
                <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-300">
                        Transactions ({faucetTxs.length})
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
                                    Transaction
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
                                    Details
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-slate-800 divide-y divide-gray-200">
                            {currentFaucetTxs.length > 0 ? (
                                currentFaucetTxs.map((tx: any, index: number) => (
                                    <tr key={index}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-100">
                                                {tx.transactionType}
                                            </div>
                                            <div className="text-sm text-gray-300">
                                                {tx.faucetAddress}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-300">
                                                <p>Initiator: {tx.initiator}</p>
                                                <p>Amount: {tx.amount.toString()}</p>
                                                <p>Type: {tx.isEther ? 'Ether' : 'Token'}</p>
                                                <p>Date: {new Date(Number(tx.timestamp) * 1000).toLocaleString()}</p>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">
                                        {selectedFaucet ? "No transactions found" : "Select a faucet to view transactions"}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {faucetTxs.length > itemsPerPage && (
                    <div className="bg-slate-500 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                        <div className="flex-1 flex justify-between sm:hidden">
                            <button
                                onClick={() => setFaucetTxPage((p) => Math.max(1, p - 1))}
                                disabled={faucetTxPage === 1}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setFaucetTxPage((p) => Math.min(faucetTxPages, p + 1))}
                                disabled={faucetTxPage === faucetTxPages}
                                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Next
                            </button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-slate-800">
                                    Showing <span className="font-medium">{(faucetTxPage - 1) * itemsPerPage + 1}</span> to{' '}
                                    <span className="font-medium">
                                        {Math.min(faucetTxPage * itemsPerPage, faucetTxs.length)}
                                    </span>{' '}
                                    of <span className="font-medium">{faucetTxs.length}</span> results
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                    <button
                                        onClick={() => setFaucetTxPage((p) => Math.max(1, p - 1))}
                                        disabled={faucetTxPage === 1}
                                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                                    >
                                        <span className="sr-only">Previous</span>
                                        &larr; Previous
                                    </button>
                                    <div className="flex items-center px-4 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium text-gray-700">
                                        Page {faucetTxPage} of {faucetTxPages}
                                    </div>
                                    <button
                                        onClick={() => setFaucetTxPage((p) => Math.min(faucetTxPages, p + 1))}
                                        disabled={faucetTxPage === faucetTxPages}
                                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                                    >
                                        <span className="sr-only">Next</span>
                                        Next &rarr;
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* All Transaction*/}
            <div className="bg-slate-900 shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-300">
                        All Transaction on DROPCODE FACTORY ({allTxs.length})
                    </h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-slate-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
                                faucetAddress
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
                                transactionType
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
                                initiator
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
                                amount
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
                                isEther
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
                                timestamp
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-slate-800 divide-y divide-gray-200">
                        {currentAllTxs.length > 0 ? (
                            currentAllTxs.map((tx: any, index: number) => (
                                <tr key={index}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {(tx.faucetAddress).slice(0, 6) + '...' + (tx.faucetAddress).slice(-4)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {tx.transactionType}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {(tx.initiator).slice(0, 6) + '...' + (tx.initiator).slice(-4)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {tx.amount.toString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {tx.isEther ? 'Ether' : 'Token'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {new Date(Number(tx.timestamp) * 1000).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                                    {"No transactions found in the factory"}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {allTxs.length > allTxPerPage && (
                    <div className="bg-slate-500 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                        <div className="flex-1 flex justify-between sm:hidden">
                            <button
                                onClick={() => setAllTxPage((p) => Math.max(1, p - 1))}
                                disabled={allTxPage === 1}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setAllTxPage((p) => Math.min(allTxTotalPages, p + 1))}
                                disabled={allTxPage === allTxTotalPages}
                                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Next
                            </button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-slate-800">
                                    Showing <span className="font-medium">{(allTxPage - 1) * allTxPerPage + 1}</span> to{' '}
                                    <span className="font-medium">
                                        {Math.min(allTxPage * allTxPerPage, allTxs.length)}
                                    </span>{' '}
                                    of <span className="font-medium">{allTxs.length}</span> results
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                    <button
                                        onClick={() => setAllTxPage((p) => Math.max(1, p - 1))}
                                        disabled={allTxPage === 1}
                                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                                    >
                                        <span className="sr-only">Previous</span>
                                        &larr; Previous
                                    </button>
                                    <div className="flex items-center px-4 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium text-gray-700">
                                        Page {allTxPage} of {allTxTotalPages}
                                    </div>
                                    <button
                                        onClick={() => setAllTxPage((p) => Math.min(allTxTotalPages, p + 1))}
                                        disabled={allTxPage === allTxTotalPages}
                                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                                    >
                                        <span className="sr-only">Next</span>
                                        Next &rarr;
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}

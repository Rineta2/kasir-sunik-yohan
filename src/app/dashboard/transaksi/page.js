"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import { db } from "@/utils/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { FaEdit, FaTrash, FaPrint } from "react-icons/fa";
import "@/components/styles/Dashboard.scss";
import Link from "next/link";
import DeleteConfirmationModal from "@/hooks/dashboard/transaction/DeleteConfirmationModal";

export default function Transaksi() {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const transactionId = urlParams.get("id");

        if (transactionId) {
          router.push(`/dashboard/transaksi/form/${transactionId}`);
          return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const q = query(
          collection(db, "transactions"),
          orderBy("date", "desc"),
          where("date", ">=", today),
          where("date", "<", tomorrow)
        );

        const querySnapshot = await getDocs(q);
        const transactionsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate(),
        }));
        setTransactions(transactionsData);
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [router]);

  const handleDelete = (id) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      const transactionDoc = await getDoc(doc(db, "transactions", deleteId));
      const transactionData = transactionDoc.data();

      for (const item of transactionData.items) {
        const productRef = doc(db, "dataBarang", item.productId);
        const productDoc = await getDoc(productRef);

        if (productDoc.exists()) {
          const currentStock = productDoc.data().stok;
          await updateDoc(productRef, { stok: currentStock + item.quantity });
        }
      }

      await deleteDoc(doc(db, "transactions", deleteId));
      setTransactions((prev) =>
        prev.filter((transaction) => transaction.id !== deleteId)
      );
      setShowDeleteModal(false);
      alert("Transaksi berhasil dihapus!");
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert("Terjadi kesalahan saat menghapus transaksi");
    }
  };

  const handlePrint = (trans) => {
    const estimatedHeight = 90 + trans.items.length * 8 + 20;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, estimatedHeight],
    });

    const pageWidth = 80;
    const margin = 5;
    let yPos = margin;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    yPos += 7;
    doc.text("SUNIK YOHAN", pageWidth / 2, yPos, { align: "center" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    yPos += 7;
    doc.text("Kp dukuh, RT.03/RW.08, Cibadak", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 5;
    doc.text(
      "Kec. Ciampea, Kabupaten Bogor, Jawa Barat 16620",
      pageWidth / 2,
      yPos,
      { align: "center" }
    );
    yPos += 5;
    doc.text("Telp: 0812-8425-8290", pageWidth / 2, yPos, { align: "center" });

    yPos += 5;
    doc.setLineWidth(0.1);
    doc.line(margin, yPos, pageWidth - margin, yPos);

    yPos += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Struk Pembelian", pageWidth / 2, yPos, { align: "center" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    yPos += 7;
    doc.text(`No: ${trans.transactionCode}`, margin, yPos);
    yPos += 5;
    doc.text(
      `Tanggal: ${trans.date.toLocaleDateString("id-ID", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      margin,
      yPos
    );

    yPos += 6;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Produk", margin, yPos);
    doc.text("Qty", pageWidth - margin - 25, yPos, { align: "center" });
    doc.text("Total", pageWidth - margin, yPos, { align: "right" });

    doc.setFont("helvetica", "normal");
    trans.items.forEach((item) => {
      yPos += 7;
      const productName = `${item.namaBarang}${
        item.size ? ` (${item.size})` : ""
      }`;
      doc.text(
        productName.length > 20
          ? productName.substring(0, 20) + "..."
          : productName,
        margin,
        yPos
      );
      doc.text(item.quantity.toString(), pageWidth - margin - 25, yPos, {
        align: "center",
      });
      const total = item.harga * item.quantity;
      doc.text(total.toLocaleString("id-ID"), pageWidth - margin, yPos, {
        align: "right",
      });
    });

    yPos += 7;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Total:", pageWidth - margin - 35, yPos);
    doc.text(trans.total.toLocaleString("id-ID"), pageWidth - margin, yPos, {
      align: "right",
    });

    yPos += 5;
    doc.setFont("helvetica", "normal");
    doc.text("Pembayaran:", pageWidth - margin - 35, yPos);
    doc.text(
      trans.paymentAmount.toLocaleString("id-ID"),
      pageWidth - margin,
      yPos,
      { align: "right" }
    );

    yPos += 5;
    doc.text("Kembalian:", pageWidth - margin - 35, yPos);
    doc.text(trans.change.toLocaleString("id-ID"), pageWidth - margin, yPos, {
      align: "right",
    });

    yPos += 10;
    doc.setFontSize(7);
    doc.text("Terima kasih atas kunjungan Anda", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 4;
    doc.text("Barang yang sudah dibeli tidak dapat", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 4;
    doc.text("ditukar/dikembalikan", pageWidth / 2, yPos, { align: "center" });

    try {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url);

      printWindow.onload = () => {
        printWindow.print();
        URL.revokeObjectURL(url);
      };
    } catch (error) {
      console.error("Printing error:", error);
      alert("Gagal mencetak struk. Silakan coba lagi.");
    }
  };

  return (
    <section className="transaksi">
      <div className="transaksi__container container">
        <div
          className="heading"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
          }}
        >
          <h1>Daftar Transaksi</h1>
          <Link href="/dashboard/transaksi/form">Tambahkan Transaksi</Link>
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: "4rem" }}>
            <div className="spinner-border" role="status"></div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Kode Transaksi</th>
                  <th>Tanggal</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Pembayaran</th>
                  <th>Kembalian</th>
                  <th>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {transactions.map((transaction, index) => (
                  <tr key={transaction.id}>
                    <td>{index + 1}</td>
                    <td>{transaction.transactionCode}</td>
                    <td>
                      {transaction.date?.toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>
                      <ul className="list-unstyled">
                        {transaction.items.map((item, idx) => (
                          <li key={idx}>
                            {item.namaBarang} {item.size && `(${item.size})`} (
                            {item.quantity}x @Rp{" "}
                            {(item.harga || 0).toLocaleString()})
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>Rp {transaction.total.toLocaleString()}</td>
                    <td>Rp {transaction.paymentAmount.toLocaleString()}</td>
                    <td>Rp {transaction.change.toLocaleString()}</td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          width: "100%",
                        }}
                      >
                        <Link
                          href={`/dashboard/transaksi/form?id=${transaction.id}`}
                          className="edit"
                        >
                          <FaEdit />
                        </Link>
                        <button
                          className="delete"
                          onClick={() => handleDelete(transaction.id)}
                        >
                          <FaTrash />
                        </button>
                        <button
                          className="print"
                          onClick={() => handlePrint(transaction)}
                        >
                          <FaPrint />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

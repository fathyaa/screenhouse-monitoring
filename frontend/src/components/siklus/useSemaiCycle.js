import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { API_URL } from "../../config/api";

export function useSemaiCycle(screenhouseId, token, onCycleChanged) {
  const [activeCycle, setActiveCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadActiveCycle = useCallback(() => {
    if (!screenhouseId || !token) {
      setActiveCycle(null);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return fetch(`${API_URL}/screenhouses/${screenhouseId}/cycles/active`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setActiveCycle(data && data.id ? data : null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [screenhouseId, token]);

  useEffect(() => {
    loadActiveCycle();
  }, [loadActiveCycle]);

  const handleEndCycle = async () => {
    setEnding(true);
    try {
      const res = await fetch(`${API_URL}/screenhouses/${screenhouseId}/cycles/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal mengakhiri siklus");
      toast.success(`Siklus selesai — Grade ${data.grade ?? "?"}`);
      setActiveCycle(null);
      setShowEndConfirm(false);
      onCycleChanged?.(data);
    } catch (err) {
      toast.error(err.message || "Gagal mengakhiri siklus");
    } finally {
      setEnding(false);
    }
  };

  const handleCycleStarted = (data) => {
    setActiveCycle(data);
    onCycleChanged?.(data);
  };

  const handleCycleEdited = (data) => {
    setActiveCycle((prev) => (prev ? { ...prev, ...data } : data));
    onCycleChanged?.(data);
  };

  return {
    activeCycle,
    loading,
    ending,
    showStartModal,
    setShowStartModal,
    showEndConfirm,
    setShowEndConfirm,
    showEditModal,
    setShowEditModal,
    handleEndCycle,
    handleCycleStarted,
    handleCycleEdited,
    loadActiveCycle,
  };
}

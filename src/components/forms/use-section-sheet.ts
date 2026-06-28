"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  PENDING_FORM_EVENT,
  popPendingForm,
  type FormSection
} from "@/src/lib/pending-form";

type SheetState<I> = null | { editId?: string; initial?: I };

/**
 * Lógica común de las pantallas de sección (pañal/toma/duda):
 *  - estado del sheet (cerrado / alta / edición pre-cargada),
 *  - levantar el handoff de otra pantalla (voz o timeline de Inicio), tanto al
 *    montar (cross-route) como por evento (misma sección ya montada),
 *  - borrar con confirmación y refrescar.
 */
export function useSectionSheet<I>(
  section: FormSection,
  deleteAction: (formData: FormData) => Promise<void>
) {
  const router = useRouter();
  const [sheet, setSheet] = useState<SheetState<I>>(null);

  useEffect(() => {
    function pickup() {
      const pending = popPendingForm(section);
      if (pending) {
        setSheet({ editId: pending.editId, initial: pending.initial as I });
      }
    }
    pickup(); // handoff cross-route: la pantalla recién montada lo levanta
    window.addEventListener(PENDING_FORM_EVENT, pickup); // handoff misma sección
    return () => window.removeEventListener(PENDING_FORM_EVENT, pickup);
  }, [section]);

  function openAdd() {
    setSheet({});
  }

  function openEdit(editId: string, initial: I) {
    setSheet({ editId, initial });
  }

  function close() {
    setSheet(null);
  }

  async function remove(id: string) {
    if (!window.confirm("¿Eliminar este registro? No se puede deshacer.")) {
      return;
    }
    const formData = new FormData();
    formData.append("id", id);
    await deleteAction(formData);
    setSheet(null);
    router.refresh();
  }

  return { sheet, openAdd, openEdit, close, remove };
}

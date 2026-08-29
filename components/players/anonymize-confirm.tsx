"use client";

import { useState } from "react";
import { useConfirm } from "@/components/shared/confirm-dialog";

interface AnonymizeConfirmProps {
  playerName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

export function AnonymizeConfirm({ playerName, onConfirm, onCancel, isOpen }: AnonymizeConfirmProps) {
  const [confirmText, setConfirmText] = useState("");
  const { confirm } = useConfirm();

  const handleOpen = async () => {
    setConfirmText("");
    const result = await confirm({
      title: `Anonymize player "${playerName}"?`,
      description:
        "This action will permanently remove the player's personal information:\n" +
        "• Full name\n" +
        "• Photo\n" +
        "• Jersey number\n" +
        "• Position\n" +
        "• Captain status\n\n" +
        "Historical match events (goals, cards, ratings) will be preserved but shown as \"Anonymized Player\".\n\n" +
        "Type ANONYMIZE to confirm this irreversible action.",
      confirmLabel: "Anonymize",
    });
    if (result && confirmText === "ANONYMIZE") {
      onConfirm();
    } else {
      onCancel();
    }
  };

  if (!isOpen) return null;

  handleOpen();

  return null;
}
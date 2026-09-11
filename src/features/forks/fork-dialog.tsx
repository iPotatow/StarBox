import { RiGitForkLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/modal";
import { createFork } from "../../lib/api";
import type { ForkJob } from "../../types";

export function ForkDialog({
  open,
  token,
  credentialConnected,
  sourceFullName,
  onClose,
  onCreated,
}: {
  open: boolean;
  token: string;
  credentialConnected?: boolean;
  sourceFullName: string;
  onClose: () => void;
  onCreated: (job: ForkJob) => void;
}) {
  const [organization, setOrganization] = useState("");
  const [name, setName] = useState("");
  const [defaultBranchOnly, setDefaultBranchOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setOrganization("");
    setName("");
    setDefaultBranchOnly(false);
    setError("");
  }, [open, sourceFullName]);

  async function submit() {
    if (!token.trim() && !credentialConnected) {
      setError("请先在设置中连接 GitHub 凭据");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await createFork(token.trim(), {
        sourceFullName,
        organization: organization.trim() || undefined,
        name: name.trim() || undefined,
        defaultBranchOnly,
      });
      const now = new Date().toISOString();
      onCreated({
        id: crypto.randomUUID(),
        sourceFullName,
        targetOwner: result.targetOwner,
        targetName: result.targetName,
        targetFullName: result.targetFullName,
        htmlUrl: result.htmlUrl,
        status: result.status,
        createdAt: now,
        updatedAt: now,
        error: "",
        pollAttempts: 0,
        nextPollAt: result.status === "pending" ? now : null,
      });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Fork 创建失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      title={`Fork ${sourceFullName}`}
      description="目标组织与仓库名可留空；留空时使用当前 GitHub 用户和原仓库名。"
      onClose={onClose}
    >
      <div className="grid gap-4">
        <Field label="目标组织" description="可选。填写后需要 Token 对该组织具备创建仓库权限。">
          <Input value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="my-org" />
        </Field>
        <Field label="目标仓库名" description="可选。GitHub 支持为 Fork 指定新名称。">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={sourceFullName.split("/")[1] || "repo"} />
        </Field>
        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm">
          <Checkbox checked={defaultBranchOnly} onCheckedChange={setDefaultBranchOnly} aria-label="仅 Fork 默认分支" />
          仅 Fork 默认分支
        </label>
        {error ? <p className="text-sm text-destructive-foreground">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={() => void submit()} loading={loading}>
            <RiGitForkLine className="size-4" />创建 Fork
          </Button>
        </div>
      </div>
    </Modal>
  );
}

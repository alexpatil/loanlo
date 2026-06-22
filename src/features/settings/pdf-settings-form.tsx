"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { pdfSettingsSchema, type PdfSettingsInput } from "@/validations/settings.schema";
import { updatePdfSettingsAction } from "@/actions/settings.actions";
import {
  PDF_TEMPLATE_KEYS,
  PDF_TEMPLATE_LABELS,
  PDF_TEMPLATE_DESCRIPTIONS,
  PDF_DOC_TYPES,
  PDF_DOC_LABELS,
  type PdfTemplateKey,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_IMAGE_BYTES = 400 * 1024;

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PdfSettingsForm({ defaults }: { defaults: PdfSettingsInput }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PdfSettingsInput>({
    resolver: zodResolver(pdfSettingsSchema) as unknown as Resolver<PdfSettingsInput>,
    defaultValues: defaults,
  });

  const [logo, setLogo] = useState(defaults.logoUrl ?? "");
  const [signature, setSignature] = useState(defaults.signatureUrl ?? "");
  const template = (watch("defaultTemplate") ?? "CLASSIC") as PdfTemplateKey;
  const color = watch("primaryColor") ?? "#6d28d9";

  async function onImage(
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logoUrl" | "signatureUrl",
    set: (v: string) => void,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image too large (max 400 KB). Use a smaller file.");
      return;
    }
    const dataUrl = await readImage(file);
    setValue(field, dataUrl);
    set(dataUrl);
  }

  async function onSubmit(values: PdfSettingsInput) {
    const result = await updatePdfSettingsAction({ ...values, logoUrl: logo, signatureUrl: signature });
    if (result.success) toast.success(result.message ?? "Saved");
    else toast.error(result.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Company details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Company name</Label>
              <Input {...register("companyName")} placeholder="Your lending business" />
              {errors.companyName && <p className="text-xs text-rose-600">{errors.companyName.message}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input {...register("phone")} placeholder="9876543210" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input {...register("email")} placeholder="hello@company.com" />
                {errors.email && <p className="text-xs text-rose-600">{errors.email.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input {...register("address")} placeholder="Street, City, State, Pincode" />
            </div>
            <div className="space-y-1.5">
              <Label>Footer text</Label>
              <Textarea {...register("footerText")} placeholder="Thank you for your business." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Primary color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setValue("primaryColor", e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-input"
                />
                <Input className="w-36" {...register("primaryColor")} />
              </div>
              {errors.primaryColor && <p className="text-xs text-rose-600">{errors.primaryColor.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <ImageField label="Company logo" value={logo} onPick={(e) => onImage(e, "logoUrl", setLogo)} onClear={() => { setValue("logoUrl", ""); setLogo(""); }} />
              <ImageField label="Signature image" value={signature} onPick={(e) => onImage(e, "signatureUrl", setSignature)} onClear={() => { setValue("signatureUrl", ""); setSignature(""); }} />
            </div>
            <p className="text-xs text-muted-foreground">PNG/JPG up to 400 KB. Stored with your settings — no external upload needed.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default template</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {PDF_TEMPLATE_KEYS.map((key) => {
                const active = template === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setValue("defaultTemplate", key)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all",
                      active ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200" : "border-border hover:border-violet-200 hover:bg-accent",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{PDF_TEMPLATE_LABELS[key]}</p>
                      {active && <span className="text-xs font-medium text-violet-600">Default</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{PDF_TEMPLATE_DESCRIPTIONS[key]}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview + save */}
      <Card className="sticky top-20 h-fit">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Preview the <span className="font-medium">{PDF_TEMPLATE_LABELS[template]}</span> template with your saved branding.
          </p>
          <div className="space-y-2">
            {PDF_DOC_TYPES.map((doc) => (
              <Button key={doc} asChild variant="outline" className="w-full justify-start">
                <a href={`/api/pdf/preview?type=${doc}&template=${template}`} target="_blank" rel="noreferrer">
                  <Eye className="h-4 w-4" /> {PDF_DOC_LABELS[doc]}
                </a>
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: save first to preview logo, colors and company details.
          </p>
          <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

function ImageField({
  label,
  value,
  onPick,
  onClear,
}: {
  label: string;
  value: string;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-12 w-12 rounded object-contain" />
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <X className="h-4 w-4" /> Remove
          </Button>
        </div>
      ) : (
        <label className="flex h-12 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm text-muted-foreground hover:bg-accent">
          <Upload className="h-4 w-4" /> Upload image
          <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={onPick} />
        </label>
      )}
    </div>
  );
}

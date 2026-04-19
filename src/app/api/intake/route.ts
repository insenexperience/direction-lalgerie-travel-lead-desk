import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  buildIntakeRecordFromBody,
  buildLeadInsertFromIntake,
  corsHeaders,
  intakeStr,
  resolveCors,
  resolveFullNameFromIntakeBody,
  verifyIntakeSharedSecret,
} from "@/lib/intake-lead-insert";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type IntakeJson = Record<string, unknown>;

export function OPTIONS(request: Request) {
  const { allowOrigin } = resolveCors(request);
  return new NextResponse(null, { status: 204, headers: corsHeaders(allowOrigin) });
}

export async function POST(request: Request) {
  const { allowOrigin, forbidden } = resolveCors(request);
  const jsonHeaders = { ...corsHeaders(allowOrigin), "Content-Type": "application/json" };

  if (forbidden) {
    return NextResponse.json(
      { error: "Forbidden origin" },
      { status: 403, headers: jsonHeaders },
    );
  }

  if (!verifyIntakeSharedSecret(request)) {
    console.error("[api/intake] 401 — INTAKE_SHARED_SECRET est défini mais en-tête Authorization / X-Intake-Secret absent ou incorrect");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: jsonHeaders });
  }

  let body: IntakeJson;
  try {
    body = (await request.json()) as IntakeJson;
  } catch (e) {
    console.error("[api/intake] invalid JSON", e);
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const fullName = resolveFullNameFromIntakeBody(body);
  const email = intakeStr(body.email);

  if (!fullName || !email) {
    return NextResponse.json(
      {
        error: "Missing required fields",
        hint: "Envoyer email et nom (full_name ou first + last).",
      },
      { status: 422, headers: jsonHeaders },
    );
  }

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    console.error("[api/intake] Supabase service client", e);
    return NextResponse.json({ error: "DB error" }, { status: 500, headers: jsonHeaders });
  }

  const clientSubmissionId = intakeStr(body.submission_id);
  const submissionId = clientSubmissionId || randomUUID();
  const bodyForIntake: IntakeJson = { ...body, submission_id: submissionId };

  try {
    if (clientSubmissionId) {
      const { data: existing, error: findErr } = await supabase
        .from("leads")
        .select("id")
        .eq("submission_id", clientSubmissionId)
        .maybeSingle();

      if (findErr) {
        console.error("[api/intake] idempotency select", findErr);
        return NextResponse.json({ error: "DB error" }, { status: 500, headers: jsonHeaders });
      }

      if (existing?.id) {
        return NextResponse.json(
          { status: "already_received", id: String(existing.id) },
          { status: 200, headers: jsonHeaders },
        );
      }
    }

    const intake = buildIntakeRecordFromBody(bodyForIntake);
    const row = buildLeadInsertFromIntake(intake);

    const { data: created, error: insErr } = await supabase
      .from("leads")
      .insert(row)
      .select("id")
      .single();

    if (insErr || !created?.id) {
      console.error("[api/intake] insert", insErr?.message ?? insErr, insErr);
      return NextResponse.json({ error: "DB error" }, { status: 500, headers: jsonHeaders });
    }

    console.info("[api/intake] created lead", String(created.id), "submission_id", submissionId);

    revalidatePath("/leads");
    revalidatePath("/dashboard");
    revalidatePath("/metrics");

    return NextResponse.json(
      { status: "created", id: String(created.id) },
      { status: 201, headers: jsonHeaders },
    );
  } catch (e) {
    console.error("[api/intake] unexpected", e);
    return NextResponse.json({ error: "DB error" }, { status: 500, headers: jsonHeaders });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

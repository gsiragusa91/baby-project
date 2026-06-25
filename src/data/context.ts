import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Baby, FamilyMemberRole } from "@/src/domain/types";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type FamilyMemberRow = {
  family_id: string;
  role: FamilyMemberRole;
};

type BabyRow = {
  id: string;
  family_id: string;
  name: string;
  birth_date: string;
  created_at: string;
};

export type ReadyFamilyContext = {
  status: "ready";
  supabase: SupabaseClient;
  user: User;
  familyId: string;
  role: FamilyMemberRole;
  baby: Baby;
};

export type FamilyContext =
  | ReadyFamilyContext
  | { status: "unauthenticated" }
  | { status: "missing-family"; user: User };

export async function getFamilyContext(): Promise<FamilyContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "unauthenticated" };
  }

  const { data: member, error: memberError } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  const familyMember = member as FamilyMemberRow | null;

  if (!familyMember) {
    return { status: "missing-family", user };
  }

  const { data: baby, error: babyError } = await supabase
    .from("babies")
    .select("id, family_id, name, birth_date, created_at")
    .eq("family_id", familyMember.family_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (babyError) {
    throw new Error(babyError.message);
  }

  const babyRow = baby as BabyRow;

  return {
    status: "ready",
    supabase,
    user,
    familyId: familyMember.family_id,
    role: familyMember.role,
    baby: {
      id: babyRow.id,
      familyId: babyRow.family_id,
      name: babyRow.name,
      birthDate: babyRow.birth_date,
      createdAt: babyRow.created_at
    }
  };
}

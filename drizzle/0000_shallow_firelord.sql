CREATE TYPE "public"."actor_status" AS ENUM('created', 'armed', 'released', 'claiming', 'succeeded', 'rejected', 'errored');--> statement-breakpoint
CREATE TYPE "public"."claim_result" AS ENUM('succeeded', 'rejected', 'errored');--> statement-breakpoint
CREATE TYPE "public"."invariant_verdict" AS ENUM('violated', 'satisfied', 'infra_error');--> statement-breakpoint
CREATE TYPE "public"."verification_run_status" AS ENUM('created', 'armed', 'released', 'evaluating', 'failed', 'verified', 'infra_error');--> statement-breakpoint
CREATE TABLE "claim_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"result" "claim_result" NOT NULL,
	"observed_remaining" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_attempts_actor_id_unique" UNIQUE("actor_id")
);
--> statement-breakpoint
CREATE TABLE "invariant_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"verdict" "invariant_verdict" NOT NULL,
	"successful_claims" integer NOT NULL,
	"persisted_claims" integer NOT NULL,
	"final_remaining" integer NOT NULL,
	"reason_code" text NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invariant_evaluations_run_id_unique" UNIQUE("run_id"),
	CONSTRAINT "invariant_evaluations_counts_non_negative" CHECK ("invariant_evaluations"."successful_claims" >= 0 AND "invariant_evaluations"."persisted_claims" >= 0 AND "invariant_evaluations"."final_remaining" >= 0)
);
--> statement-breakpoint
CREATE TABLE "repair_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"failed_run_id" uuid NOT NULL,
	"verified_run_id" uuid,
	"packet_sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repair_cycles_failed_run_id_unique" UNIQUE("failed_run_id"),
	CONSTRAINT "repair_cycles_verified_run_id_unique" UNIQUE("verified_run_id")
);
--> statement-breakpoint
CREATE TABLE "run_actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"actor_key" text NOT NULL,
	"display_name" text NOT NULL,
	"status" "actor_status" DEFAULT 'created' NOT NULL,
	"armed_at" timestamp with time zone,
	"request_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"outcome_code" text,
	CONSTRAINT "run_actors_run_id_actor_key_unique" UNIQUE("run_id","actor_key")
);
--> statement-breakpoint
CREATE TABLE "run_barriers" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"expected_count" integer DEFAULT 2 NOT NULL,
	"arrived_count" integer DEFAULT 0 NOT NULL,
	"release_version" integer DEFAULT 0 NOT NULL,
	"released_at" timestamp with time zone,
	CONSTRAINT "run_barriers_expected_count_positive" CHECK ("run_barriers"."expected_count" > 0),
	CONSTRAINT "run_barriers_arrived_count_valid" CHECK ("run_barriers"."arrived_count" >= 0 AND "run_barriers"."arrived_count" <= "run_barriers"."expected_count"),
	CONSTRAINT "run_barriers_release_version_non_negative" CHECK ("run_barriers"."release_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "scenario_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"capacity" integer NOT NULL,
	"remaining" integer NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenario_resources_run_id_unique" UNIQUE("run_id"),
	CONSTRAINT "scenario_resources_capacity_positive" CHECK ("scenario_resources"."capacity" > 0),
	CONSTRAINT "scenario_resources_remaining_valid" CHECK ("scenario_resources"."remaining" >= 0 AND "scenario_resources"."remaining" <= "scenario_resources"."capacity")
);
--> statement-breakpoint
CREATE TABLE "verification_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_key" text NOT NULL,
	"invariant_key" text NOT NULL,
	"status" "verification_run_status" DEFAULT 'created' NOT NULL,
	"repair_cycle_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "claim_attempts" ADD CONSTRAINT "claim_attempts_run_id_verification_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."verification_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_attempts" ADD CONSTRAINT "claim_attempts_actor_id_run_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."run_actors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_attempts" ADD CONSTRAINT "claim_attempts_resource_id_scenario_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."scenario_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invariant_evaluations" ADD CONSTRAINT "invariant_evaluations_run_id_verification_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."verification_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_cycles" ADD CONSTRAINT "repair_cycles_failed_run_id_verification_runs_id_fk" FOREIGN KEY ("failed_run_id") REFERENCES "public"."verification_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_cycles" ADD CONSTRAINT "repair_cycles_verified_run_id_verification_runs_id_fk" FOREIGN KEY ("verified_run_id") REFERENCES "public"."verification_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_actors" ADD CONSTRAINT "run_actors_run_id_verification_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."verification_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_barriers" ADD CONSTRAINT "run_barriers_run_id_verification_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."verification_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_resources" ADD CONSTRAINT "scenario_resources_run_id_verification_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."verification_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claim_attempts_run_id_idx" ON "claim_attempts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "invariant_evaluations_verdict_idx" ON "invariant_evaluations" USING btree ("verdict");--> statement-breakpoint
CREATE INDEX "run_actors_run_id_idx" ON "run_actors" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_actors_status_idx" ON "run_actors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "verification_runs_created_at_idx" ON "verification_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "verification_runs_status_idx" ON "verification_runs" USING btree ("status");
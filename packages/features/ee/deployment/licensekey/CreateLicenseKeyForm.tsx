import type { SessionContextValue } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc";
import type { Ensure } from "@calcom/types/utils";
import { showToast } from "@calcom/ui";
import { Alert, Button, Form, Label, TextField, ToggleGroup } from "@calcom/ui";

import { UserPermissionRole } from "../../../../prisma/enums";

export const CreateANewLicenseKeyForm = () => {
  const session = useSession();
  if (session.data?.user.role !== "ADMIN") {
    return null;
  }
  // @ts-expect-error session cannt be null due to the early return
  return <CreateANewLicenseKeyFormChild session={session} />;
};

enum BillingType {
  PER_BOOKING = "PER_BOOKING",
  PER_USER = "PER_USER",
}

enum BillingPeriod {
  MONTHLY = "MONTHLY",
  ANNUALLY = "ANNUALLY",
}

interface FormValues {
  billingType: BillingType;
  entityCount: number;
  entityPrice: number;
  billingPeriod: BillingPeriod;
  overages: number;
  billingEmail: string;
}

const CreateANewLicenseKeyFormChild = ({ session }: { session: Ensure<SessionContextValue, "data"> }) => {
  const { t } = useLocale();
  const [serverErrorMessage, setServerErrorMessage] = useState<string | null>(null);
  const isAdmin = session.data.user.role === UserPermissionRole.ADMIN;
  const newLicenseKeyFormMethods = useForm<FormValues>({
    defaultValues: {
      billingType: BillingType.PER_BOOKING,
      billingPeriod: BillingPeriod.MONTHLY,
      entityCount: 500,
      overages: 99, // $0.99
      entityPrice: 50, // $0.5
      billingEmail: undefined,
    },
  });

  const mutation = trpc.viewer.admin.createSelfHostedLicense.useMutation({
    onSuccess: async () => {
      showToast(
        `Created: We have sent a stripe checkout link to ${newLicenseKeyFormMethods.getValues(
          "billingEmail"
        )}`,
        "success"
      );
      newLicenseKeyFormMethods.reset();
    },
    onError: async (err) => {
      setServerErrorMessage(err.message);
    },
  });

  const watchedBillingPeriod = newLicenseKeyFormMethods.watch("billingPeriod");
  const watchedEntityCount = newLicenseKeyFormMethods.watch("entityCount");
  const watchedEntityPrice = newLicenseKeyFormMethods.watch("entityPrice");

  function calculateMonthlyPrice() {
    const occurance = watchedBillingPeriod === "MONTHLY" ? 1 : 12;

    const sum = watchedEntityCount * watchedEntityPrice * occurance;
    return `$ ${sum / 100} / ${occurance} months`;
  }

  return (
    <>
      <Form
        form={newLicenseKeyFormMethods}
        className="space-y-5"
        id="createOrg"
        handleSubmit={(values) => {
          mutation.mutate(values);
        }}>
        <div>
          {serverErrorMessage && (
            <div className="mb-5">
              <Alert severity="error" message={serverErrorMessage} />
            </div>
          )}

          <div className="mb-5">
            <Controller
              name="billingPeriod"
              control={newLicenseKeyFormMethods.control}
              render={({ field: { value, onChange } }) => (
                <>
                  <Label htmlFor="billingPeriod">Billing Period</Label>
                  <ToggleGroup
                    isFullWidth
                    id="billingPeriod"
                    defaultValue={value}
                    onValueChange={(e) => onChange(e)}
                    options={[
                      {
                        value: "MONTHLY",
                        label: "Monthly",
                      },
                      {
                        value: "ANNUALLY",
                        label: "Annually",
                      },
                    ]}
                  />
                </>
              )}
            />
          </div>

          <Controller
            name="billingEmail"
            control={newLicenseKeyFormMethods.control}
            rules={{
              required: t("must_enter_billing_email"),
            }}
            render={({ field: { value, onChange } }) => (
              <div className="flex">
                <TextField
                  containerClassName="w-full"
                  placeholder="john@acme.com"
                  name="billingEmail"
                  disabled={!isAdmin}
                  label="Billing Email for Customer"
                  defaultValue={value}
                  onChange={onChange}
                  autoComplete="off"
                />
              </div>
            )}
          />
        </div>
        <div>
          <Controller
            name="billingType"
            control={newLicenseKeyFormMethods.control}
            render={({ field: { value, onChange } }) => (
              <>
                <Label htmlFor="bookingType">Booking Type</Label>
                <ToggleGroup
                  isFullWidth
                  id="bookingType"
                  defaultValue={value}
                  onValueChange={(e) => onChange(e)}
                  options={[
                    {
                      value: "PER_BOOKING",
                      label: "Per Booking",
                      tooltip: "Configure pricing on a per booking basis",
                    },
                    {
                      value: "PER_USER",
                      label: "Per User",
                      tooltip: "Configure pricing on a per user basis",
                    },
                  ]}
                />
              </>
            )}
          />
        </div>

        <div className="flex flex-wrap gap-2 [&>*]:flex-1">
          <Controller
            name="entityCount"
            control={newLicenseKeyFormMethods.control}
            rules={{
              required: "Must enter a total of billable users",
            }}
            render={({ field: { value, onChange } }) => (
              <TextField
                className="mt-2"
                name="entityCount"
                label="Total entities included"
                placeholder="100"
                defaultValue={value}
                onChange={(event) => onChange(+event.target.value)}
              />
            )}
          />
          <Controller
            name="entityPrice"
            control={newLicenseKeyFormMethods.control}
            rules={{
              required: "Must enter fixed price per user",
            }}
            render={({ field: { value, onChange } }) => (
              <TextField
                className="mt-2"
                name="entityPrice"
                label="Fixed price per entity"
                addOnSuffix="$"
                defaultValue={value / 100}
                onChange={(event) => onChange(+event.target.value * 100)}
              />
            )}
          />
        </div>

        <div>
          <Controller
            name="overages"
            control={newLicenseKeyFormMethods.control}
            rules={{
              required: "Must enter overages",
            }}
            render={({ field: { value, onChange } }) => (
              <>
                <TextField
                  className="mt-2"
                  placeholder="Acme"
                  name="overages"
                  addOnSuffix="$"
                  label="Overages"
                  disabled={!isAdmin}
                  defaultValue={value / 100}
                  onChange={(event) => onChange(+event.target.value * 100)}
                  autoComplete="off"
                />
              </>
            )}
          />
        </div>

        <div className="flex space-x-2 rtl:space-x-reverse">
          <Button
            disabled={newLicenseKeyFormMethods.formState.isSubmitting}
            color="primary"
            type="submit"
            form="createOrg"
            className="w-full justify-center">
            {t("continue")} - {calculateMonthlyPrice()}
          </Button>
        </div>
      </Form>
    </>
  );
};

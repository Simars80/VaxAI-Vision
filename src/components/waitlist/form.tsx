"use client";

import {
  Box,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Grid,
  GridItem,
  Input,
  Select,
  Text,
  useToast,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { Formik, Form, FormikHelpers } from "formik";
import { tokens } from "@/components/home/_tokens";

type WaitlistValues = {
  full_name: string;
  email: string;
  organization: string;
  role: string;
  country: string;
  use_case: string;
};

const ENDPOINT = process.env.NEXT_PUBLIC_FORMS_ENDPOINT ?? "";

const inputStyle = {
  bg: "#fff",
  border: `1px solid ${tokens.rule}`,
  borderRadius: "6px",
  height: "48px",
  fontSize: "15px",
  fontFamily: "inherit",
  _hover: { borderColor: "rgba(14,17,22,0.2)" },
  _focusVisible: {
    borderColor: tokens.brand,
    boxShadow: "0 0 0 3px rgba(58,91,204,0.12)",
  },
};

const WaitlistForm = () => {
  const toast = useToast();
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  const initialValues: WaitlistValues = {
    full_name: "",
    email: "",
    organization: "",
    role: "",
    country: "",
    use_case: "",
  };

  const validate = (values: WaitlistValues) => {
    const errors: Partial<Record<keyof WaitlistValues, string>> = {};
    if (!values.full_name.trim()) errors.full_name = "Required";
    if (!values.email.trim()) errors.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
      errors.email = "Enter a valid email";
    if (!values.organization.trim()) errors.organization = "Required";
    if (!values.country.trim()) errors.country = "Required";
    return errors;
  };

  const handleSubmit = async (
    values: WaitlistValues,
    helpers: FormikHelpers<WaitlistValues>
  ) => {
    if (!ENDPOINT) {
      toast({
        title: "Form is not configured",
        description:
          "Waitlist endpoint is missing. Please try again later or email partnerships@vaxaivision.com.",
        status: "error",
        duration: 6000,
        isClosable: true,
      });
      return;
    }
    setStatus("submitting");
    try {
      await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          type: "waitlist",
          ...values,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          referrer: typeof document !== "undefined" ? document.referrer : "",
        }),
      });
      setStatus("success");
      helpers.resetForm();
      toast({
        title: "You're on the list.",
        description: "We'll reach out as we open pilot access in your region.",
        status: "success",
        duration: 6000,
        isClosable: true,
      });
    } catch {
      setStatus("error");
      toast({
        title: "Something went wrong",
        description:
          "Please try again in a moment, or email partnerships@vaxaivision.com.",
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    }
  };

  return (
    <Box
      bg="#fff"
      border={`1px solid ${tokens.rule}`}
      borderRadius="12px"
      padding={{ base: "32px 24px", md: "48px 56px" }}
      maxW="780px"
      mx="auto"
    >
      <Formik onSubmit={handleSubmit} initialValues={initialValues} validate={validate}>
        {({ values, handleChange, errors, touched, isSubmitting }) => (
          <Form>
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap="24px">
              <GridItem>
                <FormControl isInvalid={!!(errors.full_name && touched.full_name)}>
                  <FormLabel color={tokens.ink} fontSize="13px" fontWeight={600} mb="6px">
                    Full name
                  </FormLabel>
                  <Input {...inputStyle} name="full_name" value={values.full_name}
                         placeholder="Jane Doe" onChange={handleChange} />
                  <FormErrorMessage fontSize="12px">{errors.full_name}</FormErrorMessage>
                </FormControl>
              </GridItem>

              <GridItem>
                <FormControl isInvalid={!!(errors.email && touched.email)}>
                  <FormLabel color={tokens.ink} fontSize="13px" fontWeight={600} mb="6px">
                    Work email
                  </FormLabel>
                  <Input {...inputStyle} type="email" name="email" value={values.email}
                         placeholder="jane@ministry.gov" onChange={handleChange} />
                  <FormErrorMessage fontSize="12px">{errors.email}</FormErrorMessage>
                </FormControl>
              </GridItem>

              <GridItem>
                <FormControl isInvalid={!!(errors.organization && touched.organization)}>
                  <FormLabel color={tokens.ink} fontSize="13px" fontWeight={600} mb="6px">
                    Organisation
                  </FormLabel>
                  <Input {...inputStyle} name="organization" value={values.organization}
                         placeholder="Ministry of Health · NGO · Clinic" onChange={handleChange} />
                  <FormErrorMessage fontSize="12px">{errors.organization}</FormErrorMessage>
                </FormControl>
              </GridItem>

              <GridItem>
                <FormControl>
                  <FormLabel color={tokens.ink} fontSize="13px" fontWeight={600} mb="6px">
                    Role <Box as="span" color={tokens.muted} fontWeight={400}>(optional)</Box>
                  </FormLabel>
                  <Input {...inputStyle} name="role" value={values.role}
                         placeholder="e.g. Programme Director" onChange={handleChange} />
                </FormControl>
              </GridItem>

              <GridItem>
                <FormControl isInvalid={!!(errors.country && touched.country)}>
                  <FormLabel color={tokens.ink} fontSize="13px" fontWeight={600} mb="6px">
                    Country
                  </FormLabel>
                  <Input {...inputStyle} name="country" value={values.country}
                         placeholder="Nigeria" onChange={handleChange} />
                  <FormErrorMessage fontSize="12px">{errors.country}</FormErrorMessage>
                </FormControl>
              </GridItem>

              <GridItem>
                <FormControl>
                  <FormLabel color={tokens.ink} fontSize="13px" fontWeight={600} mb="6px">
                    I&apos;m interested in
                  </FormLabel>
                  <Select {...inputStyle} name="use_case" value={values.use_case}
                          onChange={handleChange} placeholder="Select one">
                    <option value="facility_pilot">Running a facility pilot</option>
                    <option value="national_rollout">National / regional rollout</option>
                    <option value="partnership">Partnership / integration</option>
                    <option value="investor">Investor / funder</option>
                    <option value="other">Other</option>
                  </Select>
                </FormControl>
              </GridItem>
            </Grid>

            {status === "success" && (
              <Text color={tokens.ok} mt="24px" fontWeight={600} fontSize="14px">
                You&apos;re on the list — we&apos;ll be in touch.
              </Text>
            )}

            <Box mt="32px" pt="24px" borderTop={`1px solid ${tokens.rule}`}
                 display="flex" justifyContent="space-between" alignItems="center"
                 flexWrap="wrap" gap="14px">
              <Text fontSize="12px" color={tokens.muted}>
                Your information stays with the VaxAI Vision team. No newsletters, no third-party sharing.
              </Text>
              <Button
                type="submit"
                bg={tokens.brand}
                color="#fff"
                h="48px"
                px="28px"
                borderRadius="6px"
                fontSize="14px"
                fontWeight={600}
                fontFamily="inherit"
                isLoading={isSubmitting || status === "submitting"}
                loadingText="Submitting…"
                _hover={{ bg: tokens.brandHover }}
                boxShadow="0 4px 14px rgba(58,91,204,0.22)"
              >
                Join the waitlist →
              </Button>
            </Box>
          </Form>
        )}
      </Formik>
    </Box>
  );
};

export default WaitlistForm;

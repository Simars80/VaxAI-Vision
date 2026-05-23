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
  Textarea,
  Text,
  useToast,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { Formik, Form, FormikHelpers } from "formik";
import { tokens } from "@/components/home/_tokens";

type ContactValues = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  organization: string;
  message: string;
};

const ENDPOINT = process.env.NEXT_PUBLIC_FORMS_ENDPOINT ?? "";

const fieldStyle = {
  bg: "#fff",
  border: `1px solid ${tokens.rule}`,
  borderRadius: "6px",
  height: "48px",
  fontSize: "15px",
  fontFamily: "inherit",
  _hover: { borderColor: "rgba(14,17,22,0.2)" },
  _focusVisible: {
    borderColor: tokens.brand,
    boxShadow: `0 0 0 3px rgba(58,91,204,0.12)`,
  },
};

const ContactForm = () => {
  const toast = useToast();
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  const initialValues: ContactValues = {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    organization: "",
    message: "",
  };

  const validate = (values: ContactValues) => {
    const errors: Partial<Record<keyof ContactValues, string>> = {};
    if (!values.first_name.trim()) errors.first_name = "Required";
    if (!values.last_name.trim()) errors.last_name = "Required";
    if (!values.email.trim()) errors.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
      errors.email = "Enter a valid email";
    if (!values.message.trim()) errors.message = "Required";
    return errors;
  };

  const handleSubmit = async (
    values: ContactValues,
    helpers: FormikHelpers<ContactValues>
  ) => {
    if (!ENDPOINT) {
      toast({
        title: "Form is not configured",
        description:
          "Contact endpoint is missing. Please try again later or email partnerships@vaxaivision.com.",
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
          type: "contact",
          ...values,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          referrer: typeof document !== "undefined" ? document.referrer : "",
        }),
      });
      setStatus("success");
      helpers.resetForm();
      toast({
        title: "Thanks — your message was received.",
        description: "We'll get back to you at the email you provided.",
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
      <Formik
        onSubmit={handleSubmit}
        initialValues={initialValues}
        validate={validate}
      >
        {({ values, handleChange, errors, touched, isSubmitting }) => (
          <Form>
            <Grid
              templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }}
              gap={{ base: "20px", md: "24px" }}
            >
              <GridItem>
                <FormControl isInvalid={!!(errors.first_name && touched.first_name)}>
                  <FormLabel
                    color={tokens.ink}
                    fontSize="13px"
                    fontWeight={600}
                    mb="6px"
                  >
                    First name
                  </FormLabel>
                  <Input
                    {...fieldStyle}
                    name="first_name"
                    value={values.first_name}
                    placeholder="Jane"
                    onChange={handleChange}
                  />
                  <FormErrorMessage fontSize="12px">
                    {errors.first_name}
                  </FormErrorMessage>
                </FormControl>
              </GridItem>

              <GridItem>
                <FormControl isInvalid={!!(errors.last_name && touched.last_name)}>
                  <FormLabel
                    color={tokens.ink}
                    fontSize="13px"
                    fontWeight={600}
                    mb="6px"
                  >
                    Last name
                  </FormLabel>
                  <Input
                    {...fieldStyle}
                    name="last_name"
                    value={values.last_name}
                    placeholder="Okafor"
                    onChange={handleChange}
                  />
                  <FormErrorMessage fontSize="12px">
                    {errors.last_name}
                  </FormErrorMessage>
                </FormControl>
              </GridItem>

              <GridItem>
                <FormControl isInvalid={!!(errors.email && touched.email)}>
                  <FormLabel
                    color={tokens.ink}
                    fontSize="13px"
                    fontWeight={600}
                    mb="6px"
                  >
                    Work email
                  </FormLabel>
                  <Input
                    {...fieldStyle}
                    type="email"
                    name="email"
                    value={values.email}
                    placeholder="jane@ministry.gov"
                    onChange={handleChange}
                  />
                  <FormErrorMessage fontSize="12px">
                    {errors.email}
                  </FormErrorMessage>
                </FormControl>
              </GridItem>

              <GridItem>
                <FormControl>
                  <FormLabel
                    color={tokens.ink}
                    fontSize="13px"
                    fontWeight={600}
                    mb="6px"
                  >
                    Phone <Box as="span" color={tokens.muted} fontWeight={400}>(optional)</Box>
                  </FormLabel>
                  <Input
                    {...fieldStyle}
                    type="tel"
                    name="phone"
                    value={values.phone}
                    placeholder="+234 …"
                    onChange={handleChange}
                  />
                </FormControl>
              </GridItem>

              <GridItem colSpan={{ base: 1, md: 2 }}>
                <FormControl>
                  <FormLabel
                    color={tokens.ink}
                    fontSize="13px"
                    fontWeight={600}
                    mb="6px"
                  >
                    Organisation <Box as="span" color={tokens.muted} fontWeight={400}>(optional)</Box>
                  </FormLabel>
                  <Input
                    {...fieldStyle}
                    name="organization"
                    value={values.organization}
                    placeholder="Ministry of Health · NGO · Clinic"
                    onChange={handleChange}
                  />
                </FormControl>
              </GridItem>

              <GridItem colSpan={{ base: 1, md: 2 }}>
                <FormControl isInvalid={!!(errors.message && touched.message)}>
                  <FormLabel
                    color={tokens.ink}
                    fontSize="13px"
                    fontWeight={600}
                    mb="6px"
                  >
                    Message
                  </FormLabel>
                  <Textarea
                    bg="#fff"
                    border={`1px solid ${tokens.rule}`}
                    borderRadius="6px"
                    fontSize="15px"
                    fontFamily="inherit"
                    padding="12px 14px"
                    name="message"
                    value={values.message}
                    placeholder="What are you working on? What outcome are you trying to land?"
                    onChange={handleChange}
                    rows={5}
                    _hover={{ borderColor: "rgba(14,17,22,0.2)" }}
                    _focusVisible={{
                      borderColor: tokens.brand,
                      boxShadow: `0 0 0 3px rgba(58,91,204,0.12)`,
                    }}
                  />
                  <FormErrorMessage fontSize="12px">
                    {errors.message}
                  </FormErrorMessage>
                </FormControl>
              </GridItem>
            </Grid>

            {status === "success" && (
              <Text color={tokens.ok} mt="24px" fontWeight={600} fontSize="14px">
                Message received — we&apos;ll be in touch shortly.
              </Text>
            )}

            <Box mt="32px" pt="24px" borderTop={`1px solid ${tokens.rule}`}
                 display="flex" justifyContent="space-between" alignItems="center"
                 flexWrap="wrap" gap="14px">
              <Text fontSize="12px" color={tokens.muted}>
                We respond within 48 hours. Urgent? Email{" "}
                <a href="mailto:partnerships@vaxaivision.com" className="vax-link">
                  partnerships@vaxaivision.com
                </a>
                .
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
                loadingText="Sending…"
                _hover={{ bg: tokens.brandHover }}
                boxShadow="0 4px 14px rgba(58,91,204,0.22)"
              >
                Send message →
              </Button>
            </Box>
          </Form>
        )}
      </Formik>
    </Box>
  );
};

export default ContactForm;

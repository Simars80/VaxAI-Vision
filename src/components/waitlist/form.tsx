"use client";

import {
  Box,
  Button,
  Center,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Input,
  Select,
  Textarea,
  Text,
  useToast,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { Formik, Form, FormikHelpers } from "formik";

type WaitlistValues = {
  full_name: string;
  email: string;
  organization: string;
  role: string;
  country: string;
  use_case: string;
};

const ENDPOINT = process.env.NEXT_PUBLIC_FORMS_ENDPOINT ?? "";

const WaitlistForm = () => {
  const toast = useToast();
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle"
  );

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
    if (!values.email.trim()) {
      errors.email = "Required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      errors.email = "Invalid email";
    }
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
        description:
          "We'll reach out as we open pilot access in your region.",
        status: "success",
        duration: 6000,
        isClosable: true,
      });
    } catch (err) {
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
    <Box>
      <Formik
        onSubmit={handleSubmit}
        initialValues={initialValues}
        validate={validate}
      >
        {({ values, handleChange, errors, touched, isSubmitting }) => (
          <Form>
            <Box display={"flex"} flexDir={"column"} gap="42px">
              <Grid
                templateColumns={{ base: "auto", md: "repeat(2,1fr)" }}
                gap={{ base: "42px", md: "63px" }}
              >
                <GridItem>
                  <FormControl
                    isInvalid={!!(errors.full_name && touched.full_name)}
                  >
                    <FormLabel
                      color="#222222"
                      fontSize={"18px"}
                      fontWeight={700}
                      mb="8px"
                    >
                      Full Name
                    </FormLabel>
                    <Input
                      borderRadius={"8px"}
                      bg="#F5F6FA"
                      border="none"
                      name="full_name"
                      value={values.full_name}
                      placeholder="Jane Doe"
                      onChange={handleChange}
                      focusBorderColor="#DA7000"
                    />
                  </FormControl>
                </GridItem>

                <GridItem>
                  <FormControl isInvalid={!!(errors.email && touched.email)}>
                    <FormLabel
                      color="#222222"
                      fontSize={"18px"}
                      fontWeight={700}
                      mb="8px"
                    >
                      Work Email
                    </FormLabel>
                    <Input
                      borderRadius={"8px"}
                      type="email"
                      bg="#F5F6FA"
                      border="none"
                      name="email"
                      value={values.email}
                      placeholder="jane@ministry.gov"
                      onChange={handleChange}
                      focusBorderColor="#DA7000"
                    />
                  </FormControl>
                </GridItem>

                <GridItem>
                  <FormControl
                    isInvalid={!!(errors.organization && touched.organization)}
                  >
                    <FormLabel
                      color="#222222"
                      fontSize={"18px"}
                      fontWeight={700}
                      mb="8px"
                    >
                      Organization
                    </FormLabel>
                    <Input
                      borderRadius={"8px"}
                      bg="#F5F6FA"
                      border="none"
                      name="organization"
                      value={values.organization}
                      placeholder="Ministry of Health / NGO / Clinic"
                      onChange={handleChange}
                      focusBorderColor="#DA7000"
                    />
                  </FormControl>
                </GridItem>

                <GridItem>
                  <FormControl>
                    <FormLabel
                      color="#222222"
                      fontSize={"18px"}
                      fontWeight={700}
                      mb="8px"
                    >
                      Role
                    </FormLabel>
                    <Input
                      borderRadius={"8px"}
                      bg="#F5F6FA"
                      border="none"
                      name="role"
                      value={values.role}
                      placeholder="e.g. Program Director"
                      onChange={handleChange}
                      focusBorderColor="#DA7000"
                    />
                  </FormControl>
                </GridItem>

                <GridItem>
                  <FormControl
                    isInvalid={!!(errors.country && touched.country)}
                  >
                    <FormLabel
                      color="#222222"
                      fontSize={"18px"}
                      fontWeight={700}
                      mb="8px"
                    >
                      Country
                    </FormLabel>
                    <Input
                      borderRadius={"8px"}
                      bg="#F5F6FA"
                      border="none"
                      name="country"
                      value={values.country}
                      placeholder="Nigeria"
                      onChange={handleChange}
                      focusBorderColor="#DA7000"
                    />
                  </FormControl>
                </GridItem>

                <GridItem>
                  <FormControl>
                    <FormLabel
                      color="#222222"
                      fontSize={"18px"}
                      fontWeight={700}
                      mb="8px"
                    >
                      I'm interested in
                    </FormLabel>
                    <Select
                      borderRadius={"8px"}
                      bg="#F5F6FA"
                      border="none"
                      name="use_case"
                      value={values.use_case}
                      onChange={handleChange}
                      focusBorderColor="#DA7000"
                      placeholder="Select one"
                    >
                      <option value="facility_pilot">
                        Running a facility pilot
                      </option>
                      <option value="national_rollout">
                        National / regional rollout
                      </option>
                      <option value="partnership">
                        Partnership / integration
                      </option>
                      <option value="investor">Investor / funder</option>
                      <option value="other">Other</option>
                    </Select>
                  </FormControl>
                </GridItem>
              </Grid>
            </Box>

            {status === "success" && (
              <Text color="#0A8A5F" mt="24px" fontWeight={600} textAlign="center">
                You're on the list — we'll be in touch.
              </Text>
            )}

            <Center>
              <Button
                type="submit"
                w={{ base: "auto", md: "712px" }}
                borderRadius={"8px"}
                bg="#3A5BCC"
                color="#fff"
                mt="40px"
                isLoading={isSubmitting || status === "submitting"}
                loadingText="Submitting..."
                _hover={{
                  opacity: 0.8,
                }}
              >
                Join the Waitlist
              </Button>
            </Center>
          </Form>
        )}
      </Formik>
    </Box>
  );
};

export default WaitlistForm;

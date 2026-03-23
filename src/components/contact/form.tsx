import {
  Box,
  Button,
  Center,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Input,
  Textarea,
} from "@chakra-ui/react";
import React from "react";
import { Formik, Form } from "formik";

const ContactForm = () => {
  let initialValues = {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    message: "",
  };

  const handleSubmit = (doc: any) => {
    console.log(doc);
  };
  return (
    <Box>
      <Formik onSubmit={handleSubmit} initialValues={initialValues}>
        {({ values, handleChange }) => (
          <Form>
            <Box display={"flex"} flexDir={"column"} gap="42px">
              <Grid
                templateColumns={{ base: "auto", md: "repeat(2,1fr)" }}
                gap={{ base: "42px", md: "63px" }}
              >
                <GridItem>
                  <FormControl>
                    <FormLabel
                      color="#222222"
                      fontSize={"18px"}
                      fontWeight={700}
                      mb="8px"
                    >
                      First Name
                    </FormLabel>
                    <Input
                      borderRadius={"8px"}
                      bg="#F5F6FA"
                      border="none"
                      name="first_name"
                      value={values.first_name}
                      placeholder="John"
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
                      Last Name
                    </FormLabel>
                    <Input
                      borderRadius={"8px"}
                      bg="#F5F6FA"
                      border="none"
                      name="last_name"
                      value={values.last_name}
                      placeholder="Samuel"
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
                      Email Address
                    </FormLabel>
                    <Input
                      borderRadius={"8px"}
                      type="email"
                      bg="#F5F6FA"
                      border="none"
                      name="email"
                      value={values.email}
                      placeholder="example@gmail.com"
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
                      Phone Number
                    </FormLabel>
                    <Input
                      borderRadius={"8px"}
                      type="number"
                      bg="#F5F6FA"
                      border="none"
                      name="phone"
                      value={values.phone}
                      placeholder="Phone Number"
                      onChange={handleChange}
                      focusBorderColor="#DA7000"
                    />
                  </FormControl>
                </GridItem>
              </Grid>

              <FormControl>
                <FormLabel
                  color="#222222"
                  fontSize={"18px"}
                  fontWeight={700}
                  mb="8px"
                >
                  Message
                </FormLabel>
                <Textarea
                  borderRadius={"8px"}
                  bg="#F5F6FA"
                  border="none"
                  name="message"
                  value={values.message}
                  placeholder="Type something here..."
                  onChange={handleChange}
                  focusBorderColor="#DA7000"
                  rows={5}
                />
              </FormControl>
            </Box>
            <Center>
              <Button
                type="submit"
                w={{ base: "auto", md: "712px" }}
                borderRadius={"8px"}
                bg="#3A5BCC"
                color="#fff"
                mt="40px"
                _hover={{
                  opacity: 0.8,
                }}
              >
                Send
              </Button>
            </Center>
          </Form>
        )}
      </Formik>
    </Box>
  );
};

export default ContactForm;

"use client"

import ApolloWrapper from "@/app/lib/ApolloWrapper";
import {useRouter} from "next/navigation";
import {useEffect} from "react";
import Navigation from "@/app/store/Navigation";

export default function StoreLayout({children}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const onAuthError = () => router.push("/auth")

  useEffect(() => {
    const token = localStorage ? localStorage?.getItem("token") : "";
    if (!token) onAuthError()
  })

  return (
    <ApolloWrapper onAuthError={onAuthError}>
      <Navigation/>
      {children}
    </ApolloWrapper>
  )
}

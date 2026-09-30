import { connection } from "next/server";
import { Landing } from "@/components/site/landing";
import { getReleaseFile } from "@/lib/release-file";

export default async function Home() {
  await connection();
  const file = await getReleaseFile();
  return <Landing file={file} />;
}

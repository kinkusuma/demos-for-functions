import * as sdk from "https://deno.land/x/appwrite@0.4.0/mod.ts";
import { config } from "https://deno.land/x/dotenv@v3.0.0/mod.ts";

// Export dotenv file to Deno.env
config({ export: true });

const client = new sdk.Client();
const storage = new sdk.Storage(client);

client
  .setEndpoint(Deno.env.get("APPWRITE_API_ENDPOINT")) // Your API Endpoint
  .setProject(Deno.env.get("APPWRITE_PROJECT_ID")) // Your project ID
  .setKey(Deno.env.get("APPWRITE_API_KEY")); // Your secret API key

const { id } = JSON.parse(Deno.env.get("APPWRITE_FUNCTION_DATA"));

const parseRawTextResponse = async (rawResponse) => {
  return JSON.parse(await rawResponse.text());
};

const postJobsToCloudConvert = async (jobs) => {
  const rawResponse = await fetch("https://api.cloudconvert.com/v2/jobs", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + Deno.env.get("CLOUDCONVERT_API_KEY"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(jobs),
  });
  return await parseRawTextResponse(rawResponse);
};

const createFormData = async (uploadTask) => {
  const formData = new FormData();

  for (const parameter in uploadTask.result.form.parameters) {
    formData.append(parameter, uploadTask.result.form.parameters[parameter]);
  }

  const fileMetadata = await storage.getFile(id);
  const file = await storage.getFileDownload(id);
  const reader = await file.blob();
  formData.append("file", reader, fileMetadata.name);
  return formData;
};

const uploadFormDataToCloudConvert = async (uploadTask, formData) => {
  await fetch(uploadTask.result.form.url, {
    method: "POST",
    body: formData,
  });
};

const waitForJobToFinish = async (jobId) => {
  const response = await fetch(
    "https://api.cloudconvert.com/v2/jobs/" + jobId + "/wait",
    {
      headers: {
        Authorization: "Bearer " + Deno.env.get("CLOUDCONVERT_API_KEY"),
        "Content-Type": "application/json",
      },
    }
  );
  return parseRawTextResponse(response);
};

const downloadOptimizedFile = async (url) => {
  const optimizedFileResponse = await fetch(url);
  return await optimizedFileResponse.blob();
};

const jobs = {
  tasks: {
    "upload-file": {
      operation: "import/upload",
    },
    "optimize-file": {
      operation: "optimize",
      input: ["upload-file"],
    },
    "optimized-file-url": {
      operation: "export/url",
      input: ["optimize-file"],
      inline: false,
      archive_multiple_files: false,
    },
  },
};

const response = await postJobsToCloudConvert(jobs);

const uploadTask = response.data.tasks.filter(
  (task) => task.name === "upload-file"
)[0];

const jobId = response.data.id;
const formData = await createFormData(uploadTask);
await uploadFormDataToCloudConvert(uploadTask, formData);
const result = await waitForJobToFinish(jobId);

const downloadTask = result.data.tasks.filter(
  (task) => task.name === "optimized-file-url"
)[0];

const downloadUrl = downloadTask.result.files[0].url;
const filename = downloadTask.result.files[0].filename;

const optimizedFileBlob = await downloadOptimizedFile(downloadUrl);
const optimizedFile = new File([optimizedFileBlob], filename);
console.log(await storage.createFile(optimizedFile));

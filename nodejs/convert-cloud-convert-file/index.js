const sdk = require("node-appwrite");
const CloudConvert = require("cloudconvert");
const { Readable } = require("stream");
const axios = require("axios");

require("dotenv").config();

const client = new sdk.Client();
const storage = new sdk.Storage(client);
const cloudConvert = new CloudConvert(process.env.CLOUD_CONVERT_API_KEY); // to use the Sandbox, pass true as second parameter

client
  .setEndpoint(process.env.APPWRITE_API_ENDPOINT) // Your API Endpoint
  .setProject(process.env.APPWRITE_PROJECT_ID) // Your project ID
  .setKey(process.env.APPWRITE_API_KEY); // Your secret API key

const appwriteParameters = JSON.parse(process.env.APPWRITE_FUNCTION_DATA);

const createCloudConvertJob = async () => {
  let job = await cloudConvert.jobs.create({
    tasks: {
      "upload-file": {
        operation: "import/upload",
      },
      "convert-file": {
        operation: "convert",
        input: ["upload-file"],
        output_format: "jpg",
      },
      "export-file": {
        operation: "export/url",
        input: ["convert-file"],
        inline: false,
        archive_multiple_files: true,
      },
    },
  });

  const uploadTask = job.tasks.filter((task) => task.name === "upload-file")[0];
  const fileDetails = await storage.getFile(appwriteParameters.id);
  const fileBuffer = Buffer.from(
    await storage.getFileDownload(appwriteParameters.id),
    "utf-8"
  );
  const inputFile = Readable.from(fileBuffer);
  await cloudConvert.tasks.upload(uploadTask, inputFile, fileDetails.name);

  job = await cloudConvert.jobs.wait(job.id); // Wait for job completion

  const exportTask = job.tasks.filter(
    (task) => task.operation === "export/url" && task.status === "finished"
  )[0];
  const file = exportTask.result.files[0];

  const response = await axios.get(file.url, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data, "utf-8");

  const stream = Readable.from(buffer);
  stream.name = file.filename;
  const convertedFile = await storage.createFile(stream);
  return convertedFile.$id;
};

createCloudConvertJob().then((id) => console.log(id));

<?php

include './vendor/autoload.php';
use Appwrite\Client;
use Appwrite\Services\Database;



$appwriteEndpoint = $_ENV['APPWRITE_ENDPOINT'];
$appwriteProjectId = $_ENV['APPWRITE_FUNCTION_PROJECT_ID'];
$appwriteAPIKey = $_ENV['APPWRITE_API_KEY'];

$client = new Client();
$client
    ->setEndpoint($appwriteEndpoint)
    ->setProject($appwriteProjectId)
    ->setKey($appwriteAPIKey);

$database = new Database($client);

$data = array("updatedAt" => date(DATE_ISO8601,time()));

$payload = json_decode($_ENV['APPWRITE_FUNCTION_DATA']); 

$collectionId = $payload->collectionId;
$documentId = $payload->documentId;

$result = $database->updateDocument($collectionId, $documentId, $data);

print_r(json_encode($result));
# document-conversion-service
Microservice to convert `docx` documents from the Flemish Chancery to semantically structured html fragements.
The service only supports specific types of documents, which are based on on official templates:
- [Nota](https://github.com/kanselarij-vlaanderen/kaleidos-data/blob/1e3074bc0392d50377c6bc9e9d5ea06f15cbe3c5/document-types.ttl#L6): "Nota aan de Vlaamse Regering" (template source [here](https://overheid.vlaanderen.be/regelgeving/wetgevingstechniek/voorbeeld-modellen-nota/mededeling/verslag-aan-de-regering))



## Installation
Add the following snippet to your `docker-compose.yml` to include the file service in your project.

```yaml
document-conversion:
  image: kanselarij/document-conversion-service:latest
  links:
    - database:database
  volumes:
    - ./data/files:/share
```

## REST API

#### GET /convert-document-version/:id
Convert the related file from a document version with given id to a semantically structered html fragment. The converted fragment is attached to the `document-version`-resource by means of the `ext:convertedFile`-predicate.

##### Response
###### 200 OK
Returned when the document conversion succeeded.

###### 404 Bad Request
Returned when the document conversion failed, most likely due to the document type not being suited for conversion.


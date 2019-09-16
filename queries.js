"use strict";

import path from 'path';

import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { uuid, sparqlEscapeUri, sparqlEscapeString, sparqlEscapeInt, sparqlEscapeDateTime } from 'mu';

import config from './config';

const createFileDataObject = async function (fileProperties, shareFolderSubPath, fileGraph = config.MU_APPLICATION_GRAPH) {
  const virtualUuid = fileProperties.uuid || uuid();
  const physicalUuid = fileProperties.physicalUuid || uuid();
  const fileObjectUri = config.FILE_RESOURCES_PATH + virtualUuid; // We assume trailing slash
  const filePath = path.join(shareFolderSubPath, physicalUuid);
  const physicalUri = 'share://' + filePath;

  let q = `
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX dbpedia: <http://dbpedia.org/ontology/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(fileGraph)} {
        ${sparqlEscapeUri(fileObjectUri)} a nfo:FileDataObject;
          mu:uuid ${sparqlEscapeString(virtualUuid)};
          nfo:fileName ${sparqlEscapeString(fileProperties.name)};
          dct:format ${sparqlEscapeString(fileProperties.type)};
          nfo:fileSize ${sparqlEscapeInt(fileProperties.size)};
          dbpedia:fileExtension ${sparqlEscapeString(fileProperties.extension)};
          nfo:fileCreated ${sparqlEscapeDateTime(fileProperties.created)}.
        ${sparqlEscapeUri(physicalUri)} a nfo:FileDataObject;
          mu:uuid  ${sparqlEscapeString(physicalUuid)};
          nfo:fileName ${sparqlEscapeString(fileProperties.name)};
          dct:format ${sparqlEscapeString(fileProperties.type)};
          nfo:fileSize ${sparqlEscapeInt(fileProperties.size)};
          dbpedia:fileExtension ${sparqlEscapeString(fileProperties.extension)};
          nfo:fileCreated ${sparqlEscapeDateTime(fileProperties.created)};
          nie:dataSource ${sparqlEscapeUri(fileObjectUri)}.
      }
    }
  `;
  return update(q);
};

const removeFileDataObject = async function (fileObjectUri) {
  let q = `
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

    DELETE {
      GRAPH <http://mu.semte.ch/graphs/public> {
        ${sparqlEscapeUri(fileObjectUri)} ?q ?r.
        ?physicalFile ?s ?t.
      }
    }
    WHERE {
      GRAPH <http://mu.semte.ch/graphs/public> {
        # Virtual file resource
        ${sparqlEscapeUri(fileObjectUri)} a nfo:FileDataObject;
          ?q ?r.
        # Physical file resource
        OPTIONAL {
          ?physicalFile a nfo:FileDataObject;
            nie:dataSource ${sparqlEscapeUri(fileObjectUri)};
            ?s ?t.
        }
        #HACK for the sprintf issue
        ${sparqlEscapeUri(fileObjectUri)} ?p ?o.
      }
    }
  `;
  return update(q);
};

/**
 * retrieve document version and its associated file/
 * @method fetchDocumentVersion
 * @param {str} DocumentVersionUuid
 * @return {Array}
 */
const fetchDocumentVersion = async function (documentVersionUuid) {
  let q = `
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX dbpedia: <http://dbpedia.org/ontology/>
    PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>
    
    SELECT ?documentVersion ?name ?documentType ?physicalFile ?fileExtension ?fileGraph
    WHERE {
      GRAPH ?documentGraph {
        ?documentVersion a ext:DocumentVersie;
          mu:uuid ${sparqlEscapeString(documentVersionUuid)};
          ext:file ?file.
        OPTIONAL {?document a foaf:Document;
          besluitvorming:heeftVersie ?documentVersion;
          ext:documentType ?documentType. }
      }
      GRAPH ?fileGraph {
        ?file dbpedia:fileExtension ?fileExtension;
          nfo:fileName ?name.
        ?physicalFile nie:dataSource ?file.
      }
    }
  `;
  return query(q);
};

/**
 * retrieve all documentversions that arent converted yet
 * @method fetchUnconvertedDocumentVersions
 * @return {Array}
 */
const fetchUnconvertedDocumentVersions = async function () {
  let q = `
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX dbpedia: <http://dbpedia.org/ontology/>
    PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>
    
    SELECT ?documentVersion ?documentVersionUuid
    WHERE {
      GRAPH ?documentGraph {
        ?documentVersion a ext:DocumentVersie;
          mu:uuid ?documentVersionUuid.
        ?document a foaf:Document;
          besluitvorming:heeftVersie ?documentVersion;
          ext:documentType ?documentType.
        FILTER NOT EXISTS { ?documentVersion ext:convertedFile ?convertedFile. }
      }
      FILTER ( ?documentType IN (${sparqlEscapeUri(config.NOTA_URI)}, ${sparqlEscapeUri(config.BVR_URI)}) )
    }
  `;
  return query(q);
};

/**
 * upsert the converted file associated to a document version.
 * @method upsertConvertedFile
 * @param {URI} documentVersionUri
 * @param {URI} newFileUri
 * @return {Array}
 */
const upsertConvertedFile = async function (documentVersionUri, newFileUri) {
  let q = `
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX dbpedia: <http://dbpedia.org/ontology/>
    PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>

    DELETE {
      GRAPH ?g {
        ${sparqlEscapeUri(documentVersionUri)} ext:convertedFile ?oldConvertedFile.
      }
    }
    INSERT {
      GRAPH ?g {
        ${sparqlEscapeUri(documentVersionUri)} ext:convertedFile ${sparqlEscapeUri(newFileUri)}.
      }
    }
    WHERE {
      GRAPH ?g {
        ${sparqlEscapeUri(documentVersionUri)} a ext:DocumentVersie.
        OPTIONAL { ${sparqlEscapeUri(documentVersionUri)} ext:convertedFile ?oldConvertedFile }
      }
      GRAPH ?h {
        ${sparqlEscapeUri(newFileUri)} a nfo:FileDataObject.
      }
    }
  `;
  return update(q);
};

module.exports = {
  createFileDataObject,
  removeFileDataObject,
  fetchDocumentVersion,
  fetchUnconvertedDocumentVersions,
  upsertConvertedFile
};

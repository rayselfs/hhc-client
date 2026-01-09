/**
 * Bible Folder Configuration
 */
export enum BibleFolder {
  ROOT_ID = 'bible-root',
  ROOT_NAME = 'Bible Library',
}

/**
 * Media Folder Configuration
 */
export enum MediaFolder {
  ROOT_ID = 'media-root',
  ROOT_NAME = 'Media Library',
}

/**
 * Folder Database Store Configuration
 */
export enum FolderDBStore {
  BIBLE_DB_NAME = 'BibleDB',
  BIBLE_DB_CONTENT_STORE_NAME = 'bibleContent',
  BIBLE_DB_SEARCH_INDEX_STORE_NAME = 'bibleSearchIndex',
  BIBLE_DB_STORE_KEY_PATH = 'version_code',
  FOLDER_DB_NAME = 'FolderDB',
  FOLDER_DB_STRUCTURE_STORE_NAME = 'folder-structure',
  FOLDER_DB_THUMBNAILS_STORE_NAME = 'thumbnails',
  FOLDER_DB_STORE_KEY_PATH = 'id',
}

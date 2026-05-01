use crate::ChartError;
use eaip_manager::{
    crypto::{decompress_data, decrypt_block, derive_kek},
    format::{FileHeader, IndexBlock, Vault, HEADER_SIZE},
};
use lru::LruCache;
use std::{num::NonZeroUsize, sync::Arc};

const DEFAULT_CACHE_CAPACITY: usize = 128;

pub struct InMemoryPackageReader {
    bytes: Arc<Vec<u8>>,
    pub header: FileHeader,
    pub vault: Vault,
    pub index: IndexBlock,
    cache: LruCache<String, Vec<u8>>,
}

impl InMemoryPackageReader {
    pub fn open(bytes: Vec<u8>, password: &str) -> Result<Self, ChartError> {
        if bytes.len() < HEADER_SIZE {
            return Err(ChartError::Internal(
                "uploaded package is too small to contain a valid header".to_string(),
            ));
        }

        let bytes = Arc::new(bytes);
        let mut header_bytes = [0u8; HEADER_SIZE];
        header_bytes.copy_from_slice(&bytes[..HEADER_SIZE]);
        let header = FileHeader::from_bytes(&header_bytes).map_err(|error| {
            ChartError::Internal(format!("failed to parse uploaded package header: {error}"))
        })?;

        let kek = derive_kek(password, &header.kek_salt).map_err(|error| {
            ChartError::Internal(format!("failed to derive uploaded package key: {error}"))
        })?;

        let encrypted_vault = slice_range(&bytes, header.vault_offset, header.vault_length)
            .map_err(|error| {
                ChartError::Internal(format!("uploaded package vault block is invalid: {error}"))
            })?;
        let vault_json = decrypt_block(&kek, &header.kek_nonce, encrypted_vault, &header.magic)
            .map_err(|error| {
                ChartError::Internal(format!("failed to decrypt uploaded package vault: {error}"))
            })?;
        let vault: Vault = serde_json::from_slice(&vault_json).map_err(|error| {
            ChartError::Internal(format!(
                "failed to decode uploaded package vault JSON: {error}"
            ))
        })?;

        let final_index_block = slice_range(&bytes, header.index_offset, header.index_length)
            .map_err(|error| {
                ChartError::Internal(format!("uploaded package index block is invalid: {error}"))
            })?;

        if final_index_block.len() < 12 {
            return Err(ChartError::Internal(
                "uploaded package index block is corrupted or too short".to_string(),
            ));
        }

        let mut index_nonce = [0u8; 12];
        index_nonce.copy_from_slice(&final_index_block[0..12]);
        let index_comp_data = decrypt_block(
            &vault.master_dek,
            &index_nonce,
            &final_index_block[12..],
            b"INDEX",
        )
        .map_err(|error| {
            ChartError::Internal(format!("failed to decrypt uploaded package index: {error}"))
        })?;
        let index_raw_bytes = decompress_data(&index_comp_data).map_err(|error| {
            ChartError::Internal(format!(
                "failed to decompress uploaded package index: {error}"
            ))
        })?;
        let index = IndexBlock::from_bytes(&index_raw_bytes).map_err(|error| {
            ChartError::Internal(format!("failed to parse uploaded package index: {error}"))
        })?;

        Ok(Self {
            bytes,
            header,
            vault,
            index,
            cache: LruCache::new(NonZeroUsize::new(DEFAULT_CACHE_CAPACITY).unwrap()),
        })
    }

    pub fn set_cache_capacity(&mut self, capacity: usize) {
        if let Some(nonzero) = NonZeroUsize::new(capacity) {
            self.cache.resize(nonzero);
        }
    }

    pub fn read_file(&mut self, path: &str) -> Result<Option<Vec<u8>>, ChartError> {
        if let Some(cached) = self.cache.get(path) {
            return Ok(Some(cached.clone()));
        }

        let slot_index = match self.index.lookup.get(path) {
            Some(index) => *index,
            None => return Ok(None),
        };
        let slot = &self.index.slots[slot_index];

        let final_block =
            slice_range(&self.bytes, slot.data_offset, slot.comp_length).map_err(|error| {
                ChartError::Internal(format!(
                    "uploaded package data block for `{path}` is invalid: {error}"
                ))
            })?;

        if final_block.len() < 12 {
            return Err(ChartError::Internal(format!(
                "uploaded package data block for `{path}` is corrupted"
            )));
        }

        let mut data_nonce = [0u8; 12];
        data_nonce.copy_from_slice(&final_block[0..12]);
        let comp_data = decrypt_block(
            &self.vault.data_dek,
            &data_nonce,
            &final_block[12..],
            path.as_bytes(),
        )
        .map_err(|error| {
            ChartError::Internal(format!(
                "failed to decrypt uploaded chart `{path}`: {error}"
            ))
        })?;
        let file_data = decompress_data(&comp_data).map_err(|error| {
            ChartError::Internal(format!(
                "failed to decompress uploaded chart `{path}`: {error}"
            ))
        })?;

        if file_data.len() as u64 != slot.uncomp_length {
            return Err(ChartError::Internal(format!(
                "uploaded chart `{path}` failed length validation after decompression"
            )));
        }

        self.cache.put(path.to_string(), file_data.clone());
        Ok(Some(file_data))
    }
}

fn slice_range(bytes: &[u8], offset: u64, length: u64) -> Result<&[u8], &'static str> {
    let start = usize::try_from(offset).map_err(|_| "offset exceeds platform limits")?;
    let length = usize::try_from(length).map_err(|_| "length exceeds platform limits")?;
    let end = start.checked_add(length).ok_or("range overflow")?;
    bytes.get(start..end).ok_or("range exceeds package size")
}

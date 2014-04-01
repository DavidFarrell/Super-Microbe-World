﻿using UnityEditor;
using System.IO;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class TexturePackerImporter : AssetPostprocessor
{

	static string[] textureExtensions = {
		".png",
		".jpg",
		".jpeg",
		".tiff",
		".tga",
		".bmp"
	};

	/*
	 *  Trigger a texture file re-import each time the .tpsheet file changes (or is manually re-imported)
	 */
	static void OnPostprocessAllAssets (string[] importedAssets, string[] deletedAssets, string[] movedAssets, string[] movedFromAssetPaths)
	{
		foreach (var asset in importedAssets) {
			if (!Path.GetExtension (asset).Equals (".tpsheet"))
				continue;
			foreach (string ext in textureExtensions) {
				string pathToTexture = Path.ChangeExtension (asset, ext);
				if (File.Exists (pathToTexture)) {
					AssetDatabase.ImportAsset (pathToTexture, ImportAssetOptions.ForceUpdate);
					break;
				}
			}
		}
	}


	/*
	 *  Trigger a sprite sheet update each time the texture file changes (or is manually re-imported)
	 */
	void OnPreprocessTexture ()
	{
		TextureImporter importer = assetImporter as TextureImporter;

		string pathToData = Path.ChangeExtension (assetPath, ".tpsheet");
		if (File.Exists (pathToData)) {
			updateSpriteMetaData (importer, pathToData);
		}
	}

	static void updateSpriteMetaData (TextureImporter importer, string pathToData)
	{
		importer.textureType = TextureImporterType.Sprite;
		importer.maxTextureSize = 4096;
		importer.spriteImportMode = SpriteImportMode.Multiple;

		List<SpriteMetaData> metaData = new List<SpriteMetaData> ();
		foreach (string row in File.ReadAllLines(pathToData)) {
			if (string.IsNullOrEmpty (row) || row.StartsWith ("#"))
				continue; // comment lines start with #

			string [] cols = row.Split (';');
			if (cols.Length != 7)
				return; // format error

			SpriteMetaData smd = new SpriteMetaData ();
			smd.name = cols [0];
			float x = float.Parse (cols [1]);
			float y = float.Parse (cols [2]);
			float w = float.Parse (cols [3]);
			float h = float.Parse (cols [4]);
			float px = float.Parse (cols [5]);
			float py = float.Parse (cols [6]);

			smd.rect = new UnityEngine.Rect (x, y, w, h);
			smd.pivot = new UnityEngine.Vector2 (px, py);

			if (px == 0 && py == 0)
				smd.alignment = (int)UnityEngine.SpriteAlignment.BottomLeft;
			else if (px == 0.5 && py == 0)
				smd.alignment = (int)UnityEngine.SpriteAlignment.BottomCenter;
			else if (px == 1 && py == 0)
				smd.alignment = (int)UnityEngine.SpriteAlignment.BottomRight;
			else if (px == 0 && py == 0.5)
				smd.alignment = (int)UnityEngine.SpriteAlignment.LeftCenter;
			else if (px == 0.5 && py == 0.5)
				smd.alignment = (int)UnityEngine.SpriteAlignment.Center;
			else if (px == 1 && py == 0.5)
				smd.alignment = (int)UnityEngine.SpriteAlignment.RightCenter;
			else if (px == 0 && py == 1)
				smd.alignment = (int)UnityEngine.SpriteAlignment.TopLeft;
			else if (px == 0.5 && py == 1)
				smd.alignment = (int)UnityEngine.SpriteAlignment.TopCenter;
			else if (px == 1 && py == 1)
				smd.alignment = (int)UnityEngine.SpriteAlignment.TopRight;
			else
				smd.alignment = (int)UnityEngine.SpriteAlignment.Custom;

			metaData.Add (smd);
		}

		if (metaData.Count == 0)
			return;

		if (importer.spritesheet == null || importer.spritesheet.Length == 0) {
			// replace a blank spritesheet
			importer.spritesheet = metaData.ToArray ();
		} else {
			// merge into an existing spritesheet
			Dictionary<string,SpriteMetaData> importedSprites = new Dictionary<string, SpriteMetaData> ();
			foreach (var smd in metaData) {
				importedSprites [smd.name] = smd;
			}

			// track what has been merged
			HashSet<string> merged = new HashSet<string> ();

			List<SpriteMetaData> existingSprites = new List<SpriteMetaData> (importer.spritesheet);

			// default struct to replace deleted sprites
			SpriteMetaData deletedSMD = new SpriteMetaData ();
			deletedSMD.rect = new UnityEngine.Rect (0, 0, 1, 1);

			// maintain indices
			for (int i = 0; i < existingSprites.Count; ++i) {
				if (importedSprites.ContainsKey (existingSprites [i].name)) {
					existingSprites [i] = importedSprites [existingSprites [i].name];
					merged.Add (existingSprites [i].name);
				} else if (existingSprites [i].name.StartsWith ("DELETED_")) {
					string origName = existingSprites [i].name.Remove (0, 8);
					if (importedSprites.ContainsKey (origName)) {
						existingSprites [i] = importedSprites [origName];
						merged.Add (origName);
					}
				} else {
					deletedSMD.name = "DELETED_" + existingSprites [i].name;
					existingSprites [i] = deletedSMD;
				}
			}

			// anything not merged is appended
			foreach (var smd in metaData) {
				if (!merged.Contains (smd.name)) {
					existingSprites.Add (smd);
				}
			}
			importer.spritesheet = existingSprites.ToArray ();
		}
	}
}

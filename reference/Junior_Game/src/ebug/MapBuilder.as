/**
 * @author sbbc231
 * 
 * This class is responsible for the loading, saving and parsing of the XML files that are used to define levels.
 * 
 */
import ebug.*;
import ebug.junior.Goal;

class ebug.MapBuilder {
	public var loading:Boolean;
	public var xml:XML;
	public var level:Level;
	
	// used in dev
	public var tilesList:Array;
	
	public function MapBuilder(inTiles:Array) {
		tilesList = inTiles;	
	}
	
	public function loadLevel(levelURL:String):Void {
		this.level = new Level();
		this.loading = true;
		xml = new XML();
		xml.ignoreWhite = true;
		//_root["fps"].text = levelURL;
		xml.load(levelURL);
		xml.onLoad = function(success:Boolean):Void {
			if ( success ) {
//				_root["fps"].text = "succcess";
			} else {
	//			_root["fps"].text = "failure";
				trace ("xml file failed to load");
				
			}
		};
	}
	
	/**
	 * This function parses the level data into a level object.
	 * At present, the tileList is set prior to loading the xml data and the tile information in the level object is not used
	 */
	public function parseXML() {
		if (xml.getBytesTotal() > 0 && (xml.getBytesLoaded() == xml.getBytesTotal()) && xml.firstChild != null) {
			var levelNode:XMLNode = this.xml.firstChild;
			this.level.id = Number(levelNode.attributes.id);
			this.level.name = levelNode.attributes.name;
			this.level.bodyLevel = ( levelNode.attributes.body_level == "false" )?false: true;
			//trace ("BL: " + levelNode.attributes.body_level );
			this.level.next = levelNode.attributes.next;
			this.level.rows = Number(levelNode.attributes.rows);
			this.level.cols = Number(levelNode.attributes.cols);
			
			
			var goalNodes:XMLNode = levelNode.childNodes[0];
			var tileNodes:XMLNode = levelNode.childNodes[1];
			var rowNodes:XMLNode = levelNode.childNodes[2];
			
			level.goals = new Array();
			this.level.tiles = new Array();
			this.level.levelDataGeometry = new Array();
			
			// load goals
			for (var i = 0; i < goalNodes.childNodes.length; i ++) {
				var currentGoalData : XMLNode = goalNodes.childNodes[i];
				var currentGoal : Goal = new Goal(Number(currentGoalData.attributes.goalType), currentGoalData.attributes.microbeType, currentGoalData.attributes.required);;
				level.goals.push(currentGoal);
			}
			// load tiles 			
			for (var i = 0; i < tilesList.length; i ++) {
				if (tilesList[i]["type"] != Constants.GAME_ENTITY_ERASER) {
					var tileObject:Tile = new Tile();
					tileObject.cols = 1;
					tileObject.rows = 1;
					tileObject.id = i;
					tileObject.movie = tilesList[i]["icon"];
					tileObject.type = tilesList[i]["type"];
					tileObject.sides = new Array();
					this.level.tiles.push(tileObject);
				}
			}
			// load rows
			for (var i = 0; i < rowNodes.childNodes.length; i++ ) {
				var currentRow:XMLNode = rowNodes.childNodes[i];
				var rowId:Number = Number(currentRow.attributes.id);
				for (var j = 0;j < currentRow.childNodes.length; j++) {
					var currentColumn:XMLNode = currentRow.childNodes[j];
					var colId:Number = Number(currentColumn.attributes.id);
					var tileId:Number = Number(currentColumn.firstChild.attributes.id);
					if (this.level.levelDataGeometry[rowId] == undefined) {
						this.level.levelDataGeometry[rowId] = new Array();	
					}
					// basic tiles are treated ad geometry but other game entities are put into the entity array
					if (this.level.tiles[tileId].type != Constants.GAME_ENTITY_TILE) { 
						trace ("loading map: found an entity("+ this.level.tiles[tileId].type +") at: " + i + ", " + j);
						if (this.level.levelDataEntities[rowId] == undefined) {
							this.level.levelDataEntities[rowId] = new Array();	
						}
						this.level.levelDataEntities[rowId][colId] = tileId;
						
						// player's uniqueness is reinforced by reserving its place in the uniqueItems array
						if (this.level.tiles[tileId].type == Constants.GAME_ENTITY_PLAYER) {
							if (this.level.uniqueItems[Constants.GAME_ENTITY_PLAYER] != undefined &&
								this.level.uniqueItems[Constants.GAME_ENTITY_PLAYER] != null) {
								var oldPlayerLocation:Vector3 = this.level.uniqueItems[Constants.GAME_ENTITY_PLAYER];
								this.level.levelDataGeometry[oldPlayerLocation.y][oldPlayerLocation.x] = null;
							}
							this.level.uniqueItems[Constants.GAME_ENTITY_PLAYER] = new Vector3(colId, rowId);
						}
					} else {
						this.level.levelDataGeometry[rowId][colId] = tileId;
					}
				}
			}
			
			this.loading = false;	
		} else {
			trace ("error with loading level xml");	
		}	
	}

	/**
	 * This method flies round the tiles and generates the xml files required to store the data in files.
	 * Example XML Formatted text can be found at bottom of this method.
	 *
	 */
	function convertLevelToXML() {
		// start xml file
		var levelData:XML = new XML();
		levelData.xmlDecl = "<?xml version=\"1.0\"?>";

		// level meta-data
		var levelNode:XMLNode = new XMLNode(1, "level");
		levelNode.attributes["name"] = "new level";
		levelNode.attributes["next"] = "level2.xml";
		levelNode.attributes["body_level"] = "false";
		/*
		 *	The rows and cols attributes of the level need to be at least the size of the screen 
		 *	and usually will be the size of the longest and tallest rows / cols in the level
		 *
		 *	Rows isn't a problem because even when there are missing elements in an array,
		 *	Flash still returns the int of the largest available index.
		 *
		 *	Columns is an issue though, because we have to find the row with the most columns
		 */
		var maxWidth:Number = 0;
		for (var i:Number = 0; i < level.levelDataGeometry.length; i++) {
			if (level.levelDataGeometry[i].length > maxWidth) {
				maxWidth = level.levelDataGeometry[i].length;
			}
		}
		levelNode.attributes["rows"] = (level.levelDataGeometry.length >= Constants.SCREEN_HEIGHT / Constants.TILE_WIDTH)?level.levelDataGeometry.length:Constants.SCREEN_HEIGHT / Constants.TILE_WIDTH;
		levelNode.attributes["cols"] = (maxWidth >= Constants.SCREEN_WIDTH / Constants.TILE_WIDTH)?maxWidth:Constants.SCREEN_WIDTH / Constants.TILE_WIDTH;

		// establish level goals
		var goalNodes:XMLNode = new XMLNode(1, "goals");
		
		for (var i : Number = 0; i < level.goals.length; i++) {
			var goalNode:XMLNode = new XMLNode(1, "goal");
			var goal : Goal = Goal(level.goals[i]);
			goalNode.attributes["goalType"] = goal.goalType;
			goalNode.attributes["required"] = goal.required;
			goalNode.attributes["microbeType"] = goal.microbeType;
			goalNodes.appendChild(goalNode);
		}
		levelNode.appendChild(goalNodes);
		
		// start building xml base tile.

		// tilesNode holds <tile> nodes - each defines the id, movie, and type of the tile.
		// for tiles and 'game entities' are not differentiated in this instance.
		var tilesNode:XMLNode = new XMLNode(1, "tiles");

		// to save excess repeating of code as we build the xml object, clone this tile for children and change as required
		var baseTile:XMLNode = new XMLNode(1, "tile");

		// The linkage name of the tile - to link to a swf
		var movie:XMLNode = new XMLNode(1, "movie");

		// Game Entity Type - see Constants.as
		var type:XMLNode = new XMLNode(1, "type");

		// height of tile
		var rows:XMLNode = new XMLNode(1, "rows");

		// width of tile
		var cols:XMLNode = new XMLNode(1, "cols");

		// the physics system has static and dynamic entities - set entity to true to make this tile dynamic
		// TODO: Make this redundant and inherit from "type" above
		var entity:XMLNode= new XMLNode(1, "entity");

		// add behaviour to this tile (could define some events for 'all' tiles - hmmmm could be good idea)
		// TODO: Is this best way to do this?
		var script:XMLNode = new XMLNode(1, "script");

		// contains children (left/right/top/bottom) that define which sides of the block are solid
		var sides:XMLNode = new XMLNode(1, "sides");
		var left:XMLNode = new XMLNode(1, "left");
		var right:XMLNode = new XMLNode(1, "right");
		var top:XMLNode = new XMLNode(1, "top");
		var bottom:XMLNode = new XMLNode(1, "bottom");

		// TODO note here that ALL tiles (except player and bugs) share same properties at present for sides (can jump under them but hit off sides)
		// Most tiles WILL inherit this, but we may want to put hard ceilings on things - so will need to be able to define this
		// either by a subclass of tile, or through here and in editor.
		left.appendChild(new XMLNode(3, "1"));
		right.appendChild(new XMLNode(3, "1"));
		top.appendChild(new XMLNode(3, "1"));
		bottom.appendChild(new XMLNode(3, "0"));

		// add the side information to sides node
		sides.appendChild(left);
		sides.appendChild(right);
		sides.appendChild(top);
		sides.appendChild(bottom);

		// Set default values for a tile (1x1 square)
		rows.appendChild(new XMLNode(3, "1"));
		cols.appendChild(new XMLNode(3, "1"));
		entity.appendChild(new XMLNode(3, "0"));
		script.appendChild(new XMLNode(3, "1"));


		// Default the base tile to the details of the first tile held in the tilesList array
		baseTile.attributes["id"] = 0;
		movie.appendChild(new XMLNode(3, tilesList[0]["icon"]));
		type.appendChild(new XMLNode(3, tilesList[0]["type"]));

		// glue all the bits and bobs together into the tile xml heirarchy
		baseTile.appendChild(movie);
		baseTile.appendChild(type);
		baseTile.appendChild(sides);
		baseTile.appendChild(rows);
		baseTile.appendChild(cols);
		baseTile.appendChild(entity);
		baseTile.appendChild(script);
		tilesNode.appendChild(baseTile);

		/*
		 *  Tile nodes at the top of the xml file define the base types of tile
		 *	from which all the on-screen tiles are cloned.
		 *
		 */
		for (var tileCount:Number = 1; tileCount < tilesList.length; tileCount++) {
			if (tilesList[tileCount]["type"] != Constants.GAME_ENTITY_ERASER) {
				this["tile"+tileCount] = baseTile.cloneNode(true);
				this["tile"+tileCount].attributes["id"] = tileCount;
				// Set the 'movie' node to be the name of the linked swf.  the second 'firstchild'
				// is required because the actual answer (blue_box or whatever) is a node and you
				// have to explode it once more in order to use 'nodeValue'.
				this["tile"+tileCount].firstChild.firstChild.nodeValue = tilesList[tileCount]["icon"];
				this["tile"+tileCount].childNodes[1].firstChild.nodeValue = tilesList[tileCount]["type"];
				tilesNode.appendChild(this["tile"+tileCount]);
			}
		}
		levelNode.appendChild(tilesNode);

		/*
		 *	This is where we actually build the level by storing values for the cells.
		 *  For every row in the level, loop and get all the cols for that row.
		 *	Each combination of row and col references a tile above.
		 */
		var rowsNode:XMLNode = new XMLNode(1, "rows");
		for (var row:Number = 0; row < this.level.levelDataGeometry.length; row++) {
			var currentRow:XMLNode = new XMLNode(1, "row");
			currentRow.attributes["id"] = row;
			// for each column in this row, add to array
			for (var col:Number = 0; col < this.level.levelDataGeometry[row].length; col++) {
				if (!isNaN(this.level.levelDataGeometry[row][col])) {
					var currentCol:XMLNode = new XMLNode(1, "column");
					currentCol.attributes["id"] = col;
					var currentTile:XMLNode = new XMLNode(1, "tile");
					currentTile.attributes["id"] = this.level.levelDataGeometry[row][col];
	
					currentCol.appendChild(currentTile);
					currentRow.appendChild(currentCol);
				}
			}
			rowsNode.appendChild(currentRow);
		}
		levelNode.appendChild(rowsNode);
		levelData.appendChild(levelNode);

		trace(levelData.toString()+ "\n\n");
	}
	
	
	
	
	
	
	
	
	
	
	
}
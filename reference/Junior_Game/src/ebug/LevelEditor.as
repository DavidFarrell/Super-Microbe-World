/**
 * @author sbbc231
 */
import mx.controls.List;
import mx.containers.Window;
//import mx.managers.PopUpManager;
import mx.core.UIObject;
import flash.net.FileReference;
import ebug.*;

class ebug.LevelEditor extends Game{
	var gameState:Number;
	var mapBuilder:MapBuilder;
	var level:Level;

	// Defines which tiles are available for painting in the editor
	var rootTiles:Array;

	// holds instances of the tiles defined by above - for use when cloning a tile
	var tiles:Array;

	// holds each of the currently active / drawn tiles in it (i.e. onscreen tiles)
	var cells:Array;
	
	var dirtyScreen:Boolean;		// if true, probably want to trigger a redraw of tiles

	// these values are used to accomodate scrolling
	var screenTopLeft:Point;  		// absolute point relative to origin
	var screenBottomRight:Point;	// absolute point relative to origin
	var leftMostColumn:Number;		// a conversion of absolute points to a discrete column
	var rightMostColumn:Number;		// a conversion of absolute points to a discrete column
	var scrollSpeed:Number;			// absolute point relative to origin
	
	var scrollRight:Boolean;
	var scrollLeft:Boolean;
	var scrollUp:Boolean;
	var scrollDown:Boolean;

	var mouseCursor:MovieClip;
	var eventListener:Object;
	var topDepth:Number; 
	var window:MovieClip;

	// interface elements
	var xmlButton:UIObject;
	var leftButton:UIObject;
	var rightButton:UIObject;
	var loadButton:UIObject;

	var debugCounter:Number;

	var levelURL:String;

	public function init(palletteTiles:Array):Void {
		
		mapBuilder = new MapBuilder(palletteTiles);
		level = new Level();
		tiles = new Array();
		cells = new Array();
		rootTiles = palletteTiles;
		scrollSpeed = 20;
		scrollDown = false;
		scrollUp = false;
		scrollLeft = false;
		scrollRight = false;
		levelURL = "";


		eventListener = new Object();
		eventListener.theParent = this;
		window = createEmptyMovieClip("window", getNextHighestDepth());

		eventListener.onSelect = function(file:FileReference):Void {
			this["theParent"].levelURL = "..\\levels\\" + file.name;
			this["theParent"].gameState = Constants.STATE_LOAD_LEVEL;
		}

		dirtyScreen = true;
		gameState = Constants.STATE_INIT;
	}

	function main() {
		switch(gameState) {
			case Constants.STATE_INIT:
				screenTopLeft = new Point(0,0);
				screenBottomRight = new Point(Constants.SCREEN_WIDTH, Constants.SCREEN_HEIGHT);
				gameState = Constants.STATE_FIND_LEVEL;
				break;
			case Constants.STATE_FIND_LEVEL:
				var fileRef:FileReference = new FileReference();
				fileRef.addListener(eventListener);
				// types is a required array of file extensions to include in dialogue
				var types:Array = new Array();
				var type:Object = new Object();
				type.description = "Levels";
				type.extension = "*.xml";
				types.push(type);

				//levelURL = "..\\levels\\blank.xml"; 
				fileRef.browse(types);
				
				gameState = Constants.STATE_CLOSE;
		
		gameState = Constants.STATE_LOAD_LEVEL;
				break;
			case Constants.STATE_LOAD_LEVEL:
				mapBuilder.loadLevel(levelURL);
				gameState = Constants.STATE_LEVEL_LOADING;
				break;
			case Constants.STATE_LEVEL_LOADING:
				isLevelLoaded();
				break;
			case Constants.STATE_LEVEL_LOADED:
				gameState = Constants.STATE_LOAD_TILES;
				level = mapBuilder.level;
				/*
				 * The MapBuilder puts entities in the game entity array - but the level editor doesn't know the difference.
				 * As a result, the entity array needs integrated into the geometry array 
				 */
				for (var currentRow:Number = 0; currentRow < level.levelDataEntities.length; currentRow++) {
					for (var currentCol:Number = 0; currentCol < level.levelDataEntities[currentRow].length; currentCol++) {
						if ( !isNaN( level.levelDataEntities[currentRow][currentCol] ) ) {
							level.levelDataGeometry[currentRow][currentCol] = level.levelDataEntities[currentRow][currentCol];
						}
					}
				}
				break;
			case Constants.STATE_LOAD_TILES:
				for (var i:Number = 0; i < rootTiles.length; i++) {
					var tempClip:MovieClip = attachMovie(rootTiles[i].movie, "tile"+i, getNextHighestDepth());
					tempClip._x = 0 - tempClip._width;
					tempClip._y = 0 - tempClip._height;
					tempClip._visible = false;
					tempClip.realWidth = tempClip._width;
					tempClip.realHeight = tempClip._height;
					
					if ( tempClip._width > tempClip._height ) {
						var ratio = tempClip._width / 50;
						tempClip._width = 50;
						tempClip._height = tempClip._height / ratio;	
					} else {
						var ratio = tempClip._height / 50;
						tempClip._height = 50;
						tempClip._width = tempClip._width / ratio;
					}
					
					tiles.push(tempClip);
				}
				gameState = Constants.STATE_CREATE_GUI;
				break;
			case Constants.STATE_CREATE_GUI:
				/*
					Firsty create a mouse cursor
					Then, put in the tile list and finally
					put code in to manage clicking on the list
				*/
				mouseCursor = attachMovie("red_box", "mouseCursor", getNextHighestDepth());
				mouseCursor.tileIndex = 0;
				mouseCursor.onPress = function() {
					var col:Number = Math.ceil(this._x / Constants.TILE_WIDTH + this._parent.leftMostColumn);
					var row:Number = Math.ceil((this._parent._ymouse - (this._parent._ymouse % Constants.TILE_WIDTH) - (this._parent.screenTopLeft.yPos % Constants.TILE_WIDTH)) / 50);
					if (this._parent.cells[row] == undefined) {
						this.cells[row] = new Array();
					}
					if (this._parent.level.levelDataGeometry[row] == undefined) {
						this._parent.level.levelDataGeometry[row] = new Array();
					}
					if (this._parent.level.levelDataGeometry[row][col] == undefined) {
						this._parent.level.levelDataGeometry[row][col] = new Array();
					} else {
						this._parent["cell"+row+"-"+col].removeMovieClip();
						this._parent.level.levelDataGeometry[row][col] = null;
					}
					this._parent.level.levelDataGeometry[row][col] = this.tileIndex;
					this._parent.dirtyScreen = true;
				};

				window = createClassObject(Window, "window", getNextHighestDepth());
				var test:Window;
				
				
				/*
				 *	use this to hide window - if we decide to do that!
				 */

				/*
						this.eventListener.click = function(event){
							event.target.deletePopUp();
						}
						this.window.addEventListener("click", this.eventListener);
				*/

				window._x = 10;
				window._y = 460;
				window.title = "Paint With e-Bug!";
				window.setSize(200, 206);

				var tilesList:List;
				tilesList = window.createObject("List", "tilesList", window.getNextHighestDepth());
				tilesList.dataProvider = rootTiles;
				tilesList.iconField = "icon";
				tilesList.rowHeight = 55;
				tilesList._y = 32;
				tilesList._x = 5;
				tilesList.setSize(190, 169);

				var listListener:Object = new Object();
				listListener.theParent = this;
				listListener.change = function(eventObject:Object) {
					this.theParent.mouseCursor.removeMovieClip();
					this.theParent.mouseCursor = this.theParent.attachMovie(eventObject.target.selectedItem.movie, "mouseCursor", this.theParent.getNextHighestDepth(), {_x:this.theParent._xmouse - (this.theParent._xmouse % Constants.TILE_WIDTH) - this.theParent.screenTopLeft.xPos, _y:this.theParent._ymouse - (this.theParent._ymouse % Constants.TILE_WIDTH) - this.theParent.screenTopLeft.yPos});

					this.theParent.mouseCursor.tileIndex = eventObject.target.selectedItem.data;
					this.theParent.mouseCursor.type = eventObject.target.selectedItem.type;

					this.theParent.mouseCursor.onPress = function() {
						var col:Number = Math.ceil(this._x / Constants.TILE_WIDTH + this._parent.leftMostColumn);
						var row:Number = Math.ceil((this._parent._ymouse - (this._parent._ymouse % Constants.TILE_WIDTH)) / 50);

						/*
						 *	ensure that cell location is initialised
						 */
						if (this._parent.cells[row] == undefined) {
							this.cells[row] = new Array();
						}
						if (this._parent.level.levelDataGeometry[row] == undefined) {
							this._parent.level.levelDataGeometry[row] = new Array();
						}
						if (this._parent.level.levelDataGeometry[row][col] == undefined) {
							this._parent.level.levelDataGeometry[row][col] = new Array();
						} else {
							// there already exists a tile in this cell - so delete it
							this._parent["cell"+row+"-"+col].removeMovieClip();
							this._parent.level.levelDataGeometry[row][col] = null;
						}
						// save tile id into cell
						if (this.type != Constants.GAME_ENTITY_ERASER) {
							this._parent.level.levelDataGeometry[row][col] = this.tileIndex;
						}

						// if entity is a player start, then need to move existing player start.
						if ( this.type == Constants.GAME_ENTITY_PLAYER ) {
							if ( this._parent.level.uniqueItems[Constants.GAME_ENTITY_PLAYER] != undefined && this._parent.level.uniqueItems[Constants.GAME_ENTITY_PLAYER] != null) {
								this._parent["cell"+this._parent.level.uniqueItems[Constants.GAME_ENTITY_PLAYER].y+"-"+this._parent.level.uniqueItems[Constants.GAME_ENTITY_PLAYER].x].removeMovieClip();
								this._parent.level.levelDataGeometry[this._parent.level.uniqueItems[Constants.GAME_ENTITY_PLAYER].y][this._parent.level.uniqueItems[Constants.GAME_ENTITY_PLAYER].x] = null;
								this._parent.level.levelDataGeometry[row][col] = this.tileIndex;
								this._parent.level.uniqueItems[Constants.GAME_ENTITY_PLAYER] = new Vector3(col, row);
							} else {
								this._parent.level.uniqueItems[Constants.GAME_ENTITY_PLAYER] = new Vector3(col, row);
								this._parent.level.levelDataGeometry[row][col] = this.tileIndex;
							}
						}

						this._parent.dirtyScreen = true;
					};
				}
				tilesList.addEventListener("change", listListener);

				/*
					Now create 'left', 'right', 'generate xml' and 'load' buttons
				*/

				xmlButton = createClassObject(mx.controls.Button, "xmlButton", getNextHighestDepth(), {label:"Generate Level Code", _x:150, _y:10, _width:200});
				xmlButton.addEventListener("click", this);

				leftButton = createClassObject(mx.controls.Button, "leftButton", getNextHighestDepth(), {label:"Left", _x:20, _y:10});
				rightButton = createClassObject(mx.controls.Button, "rightButton", getNextHighestDepth(), {label:"Right", _x:800, _y:10});
				leftButton.addEventListener("click", this);
				rightButton.addEventListener("click", this);
				loadButton = createClassObject(mx.controls.Button, "loadButton", getNextHighestDepth(), {label:"Load", _x:370, _y:10});
				loadButton.addEventListener("click", this);
				gameState = Constants.STATE_UPDATE_WORLD;
				break;
			case Constants.STATE_UPDATE_WORLD:
				// this is where we move stuff and check actions
				if (scrollLeft) {
					moveScreenLeft();
					dirtyScreen = true;
				}
				if (scrollRight) {
					moveScreenRight();
					dirtyScreen = true;
				}
				if (dirtyScreen) {
					gameState = Constants.STATE_RENDER_WORLD;
					dirtyScreen = false;
				}

				// sync mouse cursor to mouse
				if (!mouseCursor._visible) {
					mouseCursor._x = -100;
				} else {
					mouseCursor._x = this._xmouse - ((this._xmouse + screenTopLeft.xPos%Constants.TILE_WIDTH) % Constants.TILE_WIDTH);
					mouseCursor._y = this._ymouse - ((this._ymouse + screenTopLeft.yPos%Constants.TILE_WIDTH) % Constants.TILE_WIDTH);
				}
				break;
			case Constants.STATE_RENDER_WORLD:
				leftMostColumn = Math.floor(screenTopLeft.xPos / Constants.TILE_WIDTH);
				rightMostColumn = Math.ceil(screenBottomRight.xPos / Constants.TILE_WIDTH);

				// loop through columns drawing tiles found in cells.
				for (var currentRow:Number = 0; currentRow < level.rows; currentRow++) {

					for (var currentCol:Number = leftMostColumn-1; currentCol <= rightMostColumn+1; currentCol++) {
						// Should there be a cell here?
						if ( !isNaN(level.levelDataGeometry[currentRow][currentCol])) {
							var currentCell:MovieClip ;
							/*
							 *  There should be a cell here but there isn't - note this test against 'row' being undefined
							 *	may seem wierd but when you remove the cell, it doesn't evaluate as null, void or undefined,
							 *	it just 'resets' the MovieClip so only way to test is to compare against a dynamic field in that MC
							 *	In this case, I've chosen to test against the 'row' vairable of the cell.
							 */
							if (cells[currentRow][currentCol] == undefined || cells[currentRow][currentCol].row == undefined) {
								if (cells[currentRow] == undefined) {
									cells[currentRow] = new Array();
								}
								// using the identifying number in the level geometry array, clone the base tile
								currentCell = tiles[level.levelDataGeometry[currentRow][currentCol]].duplicateMovieClip("cell"+currentRow+"-"+currentCol, getNextHighestDepth());
								topDepth = currentCell.getDepth();
								currentCell.row = currentRow;
								currentCell.col = currentCol;
								cells[currentRow][currentCol] = currentCell;
							} else {// there should be a cell and there is a cell at this x/y position
								currentCell = cells[currentRow][currentCol];
							}
							currentCell._x = currentCol * Constants.TILE_WIDTH - screenTopLeft.xPos;
							currentCell._y = currentRow * Constants.TILE_WIDTH + screenTopLeft.yPos;
							currentCell._width = tiles[level.levelDataGeometry[currentRow][currentCol]].realWidth;
							currentCell._height = tiles[level.levelDataGeometry[currentRow][currentCol]].realHeight;
							
							currentCell._visible = true;
							if (currentCell._x > Constants.SCREEN_WIDTH) {
								currentCell.removeMovieClip();
							} else if (currentCell._x + currentCell._width <= 0) {
								currentCell.removeMovieClip();
							}
						}
					}

					updateDepths();
				}
				gameState = Constants.STATE_UPDATE_WORLD;
				break;
		}

	}

	function updateDepths():Void {
		window.swapDepths(getNextHighestDepth());
		if (xmlButton.getDepth() != window.getDepth() - 1) {
			xmlButton.swapDepths(window.getDepth() - 1)	;
		}
		if (leftButton.getDepth() != window.getDepth() - 2) {
			leftButton.swapDepths(window.getDepth() - 2)	;
		}
		if (rightButton.getDepth() != window.getDepth() - 3) {
			rightButton.swapDepths(window.getDepth() - 3)	;
		}
		if (loadButton.getDepth() != window.getDepth() - 4) {
			loadButton.swapDepths(window.getDepth() - 4)	;
		}
		if (mouseCursor.getDepth() != window.getDepth() - 5) {
			mouseCursor.swapDepths(window.getDepth() - 5)	;
		}
	}

	function click(evt_obj:Object) {
		if(evt_obj.target._name == "xmlButton")	 {
			//convertLevelToXML();
			mapBuilder.convertLevelToXML();
		} else if (evt_obj.target._name == "leftButton")	 {
			scrollLeft = !scrollLeft;
			if (scrollRight == true) {
				scrollRight = false;
			}
		} else if (evt_obj.target._name == "rightButton")	 {
			scrollRight = !scrollRight;
			if (scrollLeft == true) {
				scrollLeft = false;
			}
		} else if (evt_obj.target._name == "loadButton") {
			// first remove all movies, then init
			for (var currentRow:Number = 0; currentRow < level.rows; currentRow++) {
				// loop cols draw cells
				for (var currentCol:Number = leftMostColumn-1; currentCol <= rightMostColumn+1; currentCol++) {
					if ( level.levelDataGeometry[currentRow][currentCol] != undefined) { // if there SHOULD be a cell here
						this["cell"+currentRow+"-"+currentCol].removeMovieClip();
					}
				}
			}
			mouseCursor.removeMovieClip();
			window.removeMovieClip();
			leftButton.removeMovieClip();
			rightButton.removeMovieClip();
			xmlButton.removeMovieClip();
			loadButton.removeMovieClip();

			init(rootTiles);
		}
	}

	function isLevelLoaded() {
		var xmlLoaded = mapBuilder.xml.getBytesLoaded();
		var xmlTotal = mapBuilder.xml.getBytesTotal();
		var percentage:Number = 0;
		if (xmlTotal > 0) {
			percentage = (xmlLoaded / xmlTotal) * 100;
		}
		if (percentage == 100) {
			if ( mapBuilder.loading == false ) {
				gameState = Constants.STATE_LEVEL_LOADED;
				level = mapBuilder.level;
			}
			else {
				mapBuilder.parseXML();
			}
		}
	}

}//eof
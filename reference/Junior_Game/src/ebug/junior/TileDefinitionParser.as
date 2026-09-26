import ebug.Constants;

class ebug.junior.TileDefinitionParser {
	
	public var loading : Boolean = false;
	public var xmlURL: String;
	private var xml : XML;
	private var interval : Number;
	
	public var tiles : Array;
	
	public function TileDefinitionParser() {
		loading = false;
		xml = new XML();
		xml.ignoreWhite = true;
		xmlURL = "";
		
		tiles = new Array();
	}
	
	public function loadXML(fileName : String) {
		xmlURL = fileName;
		xml.load(fileName);
		loading = true;
		interval = setInterval(this,"checkXMLLoaded", 40);
		xml.onLoad = function(success:Boolean):Void {
		};
		
	}
	
	public function checkXMLLoaded() {
		var nLoaded : Number = xml.getBytesLoaded();
		var nTotal : Number = xml.getBytesTotal();
		var percentage : Number = 0;
		if ( nTotal > 0 ) {
			percentage = nLoaded / nTotal * 100;
		}
		if (percentage == 100) {
			clearInterval(interval);
			parseXML();
		} 
	}
	
	/*
	 * tile definitions
	 *   tile
	 *     label
	 *     data
	 *     type		tile good bad player ammo exit eraser 
	 *     icon
	 *     movie
	 */
	public function parseXML()  {
		//rootTiles.push({label:"Generic Tile", data:dataIndex++, type:Constants.GAME_ENTITY_TILE,  icon:"tile_test", movie:"tile_test"});

		var tileDefinitionsNode : XMLNode = xml.firstChild;
		
		for ( var i : Number = 0; i < tileDefinitionsNode.childNodes.length; i++) {
			var tileNode : XMLNode = tileDefinitionsNode.childNodes[i];
			var label : String = tileNode.childNodes[0].firstChild.nodeValue;
			var typeString : String = tileNode.childNodes[2].firstChild.nodeValue;
			var iconUrl : String = tileNode.childNodes[3].firstChild.nodeValue;
			var movieUrl : String = tileNode.childNodes[4].firstChild.nodeValue;
			
			var type : Number;

			switch (typeString ) {
				case "tile":
					type = Constants.GAME_ENTITY_TILE;
					break;
				case "steve":
					type = Constants.GAME_ENTITY_STEVE;
					break ;
				case "lucy":
					type = Constants.GAME_ENTITY_LUCY;
					break ;
				case "colin":
					type = Constants.GAME_ENTITY_COLIN;
					break ;
				case "donna":
					type = Constants.GAME_ENTITY_DONNA;
					break ;
				case "iggy":
					type = Constants.GAME_ENTITY_IGGY;
					break ;
				case "patty":
					type = Constants.GAME_ENTITY_PATTY;
					break ;
				case "sandy":
					type = Constants.GAME_ENTITY_SANDY;
					break ;
				case "slurm":
					type = Constants.GAME_ENTITY_SLURM;;
					break ;
				case "slarg":
					type = Constants.GAME_ENTITY_SLARG;
					break ;
				case "super_colin":
					type = Constants.GAME_ENTITY_COLIN;
					break ;
				case "super_slarg":
					type = Constants.GAME_ENTITY_SLARG;
					break ;
				case "super_slurm":
					type = Constants.GAME_ENTITY_SLURM;
					break ;
				case "portal":
					type = Constants.GAME_ENTITY_PORTAL_EXIT;
					break ;
				case "entrance_portal":
					type = Constants.GAME_ENTITY_PORTAL_ENTRANCE;
					break ;
				case "soap_pickup":
					trace("found soap");
					type = Constants.GAME_ENTITY_AMMO_PICKUP;
					break ;
				case "white_pickup":
				trace("found white");
					type = Constants.GAME_ENTITY_AMMO_PICKUP;
					break ;
				case "player_start":
					type = Constants.GAME_ENTITY_PLAYER;
					break ;
				case "eraser":
					type = Constants.GAME_ENTITY_ERASER;
					break ;
				case "milk_glass":
					type = Constants.GAME_ENTITY_MILK;
					break ;
				case "antibiotic_pickup":
					type = Constants.GAME_ENTITY_ANTIBIOTIC_PICKUP;
					break ;
				case "superinfection":
					type = Constants.GAME_ENTITY_SUPERINFECTION;
					break ;
				default:
				trace("unknown entity found in tile definition parser: " + typeString);
					type = Constants.GAME_ENTITY_TILE;
					break ;
			}
			
			tiles.push({label:label, data:i, type:type,  icon:iconUrl, movie:movieUrl});
		}
		
		loading = false;
	}
	
}
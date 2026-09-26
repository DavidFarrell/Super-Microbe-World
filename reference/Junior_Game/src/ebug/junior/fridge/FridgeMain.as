

class ebug.junior.fridge.FridgeMain {
	private var _base : MovieClip;

	private var container : MovieClip;

	private var loadListener : Object;

	function FridgeMain(root : MovieClip) {
		base = root;
	}
	
	public function init() : Void {
		container = base.createEmptyMovieClip("game_container", base.getNextHighestDepth());	
		var label:TextField = container.createTextField("label", 1, 0, 0, 150, 20);
		label.text = "Hello World";
		
		
		loadListener = new Object();

		loadListener.onLoadStart = function(targetMC : MovieClip){
			targetMC.startTimer=getTimer();
		};
		
		loadListener.onLoadComplete = function ( targetMC : MovieClip){
			targetMC.completeTimer = getTimer();	
		};
		
		loadListener.onLoadInit = function ( targetMC : MovieClip ) {
			var timer : Number = targetMC.completeTimer - targetMC.startTimer;
			targetMC.createTextField("timertxt", targetMC.getNextHighestDepth(), 0, targetMC._height, targetMC._width, 22);
			targetMC.timertxt.text = "loaded in " + timer + "millis";

			targetMC.onMouseDown = function() {
				trace ("helo" + this._name);
				_root.game_container._x = 500;
			}
		};

		var loader : MovieClipLoader = new MovieClipLoader();
		loader.addListener(loadListener);
		loader.loadClip("harry.swf", container);
		
		
		
	}
	
	
	
	public function set base( mc : MovieClip ) : Void {
		_base = mc;
	}
	
	public function get base( ) : MovieClip {
		return _base;;
	}
	
}
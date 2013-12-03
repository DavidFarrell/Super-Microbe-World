#pragma strict


//This static class is intended to store constants, like layermasks, layer numbers and so on.
public static class utils{

	public static class layers{
	
		public var ground: int = 12;
		public var player: int = 9;
		public var nonEnemies: int = 13;
		public var enemies: int = 8;
		public var projectiles:int = 11;
	
	}
	
	public static class layerMasks{
		//We'll use the LayerMask to detect just the collisions with the ground objects when deciding where to walk. 
		//More info about layerMasks here: http://answers.unity3d.com/questions/8715/how-do-i-use-layermasks.html
		public var ground: int = 1 << utils.layers.ground;	//The number of layer for the ground is 12: so the mask will be 0000 0000 0000 0000 0001 0000 0000 0000
		public var bugs: int = (1 << utils.layers.enemies) | (1 << utils.layers.nonEnemies);	//Layer mask with two layers activated
		public var groundAndChars: int = (1 << utils.layers.ground) | (1 << utils.layers.player) | (1 << utils.layers.nonEnemies) | (1 << utils.layers.enemies);
		public var groundAndBugs: int = (1 << utils.layers.ground) | (1 << utils.layers.nonEnemies) | (1 << utils.layers.enemies);
		
	}

}